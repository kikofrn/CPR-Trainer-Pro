import Foundation
import PDFKit

@MainActor
final class ManualViewerViewModel: ObservableObject {
    let manual: Manual
    let url: URL

    @Published private(set) var document: PDFDocument?
    @Published private(set) var loadErrorMessage: String?
    @Published private(set) var pageCount = 0
    @Published private(set) var tocEntries: [ManualTOCEntry] = []
    @Published private(set) var tocSource: ManualTOCSource = .unavailable
    @Published private(set) var searchState: ManualSearchState = .idle
    @Published private(set) var searchResults: [ManualSearchResult] = []

    @Published var currentPageIndex: Int {
        didSet {
            guard currentPageIndex != oldValue else { return }

            if pageCount > 0 {
                let clamped = clampedPageIndex(currentPageIndex)
                if clamped != currentPageIndex {
                    currentPageIndex = clamped
                    return
                }
            }

            persistCurrentPage()
        }
    }

    @Published var requestedPageIndex: Int?
    @Published var isNavigationPanelPresented = false
    @Published var selectedNavigationTab: ManualNavigationTab = .contents
    @Published var searchQuery = ""

    private let tocService = ManualTOCService()
    private let searchService = ManualSearchService()
    private var searchIndex: ManualSearchIndex?
    private var indexingTask: Task<Void, Never>?
    private var searchTask: Task<Void, Never>?
    private let lastPageKey: String

    init(manual: Manual, url: URL) {
        self.manual = manual
        self.url = url
        lastPageKey = "manual.lastPage.\(manual.id)"
        currentPageIndex = UserDefaults.standard.integer(forKey: lastPageKey)
    }

    deinit {
        indexingTask?.cancel()
        searchTask?.cancel()
    }

    var currentPageNumberText: String {
        guard pageCount > 0 else { return "Page -" }
        return "Page \(currentPageIndex + 1) of \(pageCount)"
    }

    var canGoToPreviousPage: Bool {
        currentPageIndex > 0
    }

    var canGoToNextPage: Bool {
        pageCount > 0 && currentPageIndex < pageCount - 1
    }

    var pageEntries: [ManualTOCEntry] {
        tocService.generatedPageEntries(pageCount: pageCount)
    }

    func loadDocumentIfNeeded() {
        guard document == nil, loadErrorMessage == nil else { return }

        guard let loadedDocument = PDFDocument(url: url) else {
            loadErrorMessage = "This PDF could not be opened."
            searchState = .unavailable("Search is unavailable because this PDF could not be opened.")
            tocSource = .unavailable
            return
        }

        let loadedPageCount = loadedDocument.pageCount
        guard loadedPageCount > 0 else {
            loadErrorMessage = "This PDF does not contain any pages."
            searchState = .unavailable("Search is unavailable because this PDF does not contain any pages.")
            tocSource = .unavailable
            return
        }

        pageCount = loadedPageCount
        currentPageIndex = clampedPageIndex(currentPageIndex)

        let tocResult = tocService.entries(from: loadedDocument, manualID: manual.id, pageCount: loadedPageCount)
        tocEntries = tocResult.entries
        tocSource = tocResult.source
        document = loadedDocument

        startSearchIndexing()
    }

    func openNavigationPanel(tab: ManualNavigationTab) {
        selectedNavigationTab = tab
        isNavigationPanelPresented = true
    }

    func jumpToPage(_ pageIndex: Int) {
        guard pageCount > 0 else { return }
        let targetPageIndex = clampedPageIndex(pageIndex)
        currentPageIndex = targetPageIndex
        requestedPageIndex = targetPageIndex
    }

    func previousPage() {
        guard canGoToPreviousPage else { return }
        jumpToPage(currentPageIndex - 1)
    }

    func nextPage() {
        guard canGoToNextPage else { return }
        jumpToPage(currentPageIndex + 1)
    }

    func clearPendingPageRequest() {
        requestedPageIndex = nil
    }

    func updateSearchQuery(_ query: String) {
        searchQuery = query
        scheduleSearch()
    }

    func tearDown() {
        indexingTask?.cancel()
        searchTask?.cancel()
        indexingTask = nil
        searchTask = nil
    }

    private func startSearchIndexing() {
        indexingTask?.cancel()
        searchState = .indexing

        let manualURL = url
        let searchService = searchService

        indexingTask = Task { [weak self] in
            do {
                let index = try await searchService.buildIndex(for: manualURL)
                await MainActor.run {
                    self?.completeSearchIndex(index)
                }
            } catch is CancellationError {
                await MainActor.run {
                    if self?.searchState == .indexing {
                        self?.searchState = .idle
                    }
                }
            } catch {
                await MainActor.run {
                    self?.searchState = .unavailable(error.localizedDescription)
                    self?.searchResults = []
                }
            }
        }
    }

    private func completeSearchIndex(_ index: ManualSearchIndex) {
        searchIndex = index
        searchState = index.hasLimitedText ? .limitedText : .ready
        scheduleSearch()
    }

    private func scheduleSearch() {
        searchTask?.cancel()
        searchResults = []

        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, let index = searchIndex else { return }

        let searchService = searchService
        searchTask = Task { [weak self] in
            do {
                try await Task.sleep(nanoseconds: 150_000_000)
                try Task.checkCancellation()
                let results = searchService.results(for: query, in: index)
                await MainActor.run {
                    guard self?.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines) == query else { return }
                    self?.searchResults = results
                }
            } catch {
                await MainActor.run {
                    if self?.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines) == query {
                        self?.searchResults = []
                    }
                }
            }
        }
    }

    private func persistCurrentPage() {
        guard pageCount > 0 else { return }
        UserDefaults.standard.set(currentPageIndex, forKey: lastPageKey)
    }

    private func clampedPageIndex(_ pageIndex: Int) -> Int {
        guard pageCount > 0 else { return max(0, pageIndex) }
        return max(0, min(pageIndex, pageCount - 1))
    }
}
