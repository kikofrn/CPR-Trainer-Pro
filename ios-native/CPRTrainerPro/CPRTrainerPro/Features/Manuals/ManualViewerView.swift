import PDFKit
import SwiftUI

struct ManualViewerView: View {
    let manual: Manual
    let storageService: StorageService

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if let url = localManualURL {
                ManualReaderContentView(manual: manual, url: url)
            } else {
                NavigationStack {
                    ManualErrorStateView(
                        title: "Manual Not Available",
                        message: "This manual is not available in local storage yet."
                    )
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Close") {
                                dismiss()
                            }
                            .foregroundStyle(Theme.Colors.peach)
                        }
                    }
                }
            }
        }
    }

    private var localManualURL: URL? {
        guard
            storageService.fileExists(manual.filename),
            let url = try? storageService.localURL(for: manual.filename)
        else {
            return nil
        }

        return url
    }
}

private struct ManualReaderContentView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: ManualViewerViewModel

    init(manual: Manual, url: URL) {
        _viewModel = StateObject(wrappedValue: ManualViewerViewModel(manual: manual, url: url))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                if let document = viewModel.document {
                    PDFKitDocumentView(
                        document: document,
                        currentPageIndex: $viewModel.currentPageIndex,
                        requestedPageIndex: $viewModel.requestedPageIndex,
                        onRequestConsumed: {
                            viewModel.clearPendingPageRequest()
                        }
                    )
                    .ignoresSafeArea(edges: .bottom)
                    .safeAreaInset(edge: .bottom) {
                        bottomPageControls
                    }
                } else if let loadErrorMessage = viewModel.loadErrorMessage {
                    ManualErrorStateView(
                        title: "Manual Could Not Open",
                        message: loadErrorMessage
                    )
                } else {
                    ProgressView("Opening manual...")
                        .tint(Theme.Colors.peach)
                        .foregroundStyle(.white)
                }
            }
            .navigationTitle(viewModel.manual.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        closeManual()
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        Button {
                            viewModel.openNavigationPanel(tab: .contents)
                        } label: {
                            Image(systemName: "list.bullet.rectangle")
                        }
                        .accessibilityLabel("Open contents")

                        Button {
                            viewModel.openNavigationPanel(tab: .search)
                        } label: {
                            Image(systemName: "magnifyingglass")
                        }
                        .accessibilityLabel("Search manual")
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }
            }
            .task {
                viewModel.loadDocumentIfNeeded()
            }
            .sheet(isPresented: $viewModel.isNavigationPanelPresented) {
                ManualNavigationPanel(viewModel: viewModel)
                    .preferredColorScheme(.dark)
            }
            .onDisappear {
                viewModel.tearDown()
            }
        }
    }

    private var bottomPageControls: some View {
        HStack(spacing: 16) {
            Button {
                viewModel.previousPage()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.headline.weight(.bold))
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(viewModel.canGoToPreviousPage ? 0.12 : 0.05))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(!viewModel.canGoToPreviousPage)
            .foregroundStyle(viewModel.canGoToPreviousPage ? Theme.Colors.peach : .white.opacity(0.28))
            .accessibilityLabel("Previous page")

            Text(viewModel.currentPageNumberText)
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .frame(maxWidth: .infinity)

            Button {
                viewModel.nextPage()
            } label: {
                Image(systemName: "chevron.right")
                    .font(.headline.weight(.bold))
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(viewModel.canGoToNextPage ? 0.12 : 0.05))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(!viewModel.canGoToNextPage)
            .foregroundStyle(viewModel.canGoToNextPage ? Theme.Colors.peach : .white.opacity(0.28))
            .accessibilityLabel("Next page")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(.black.opacity(0.82))
        .overlay(alignment: .top) {
            Rectangle()
                .fill(.white.opacity(0.08))
                .frame(height: 1)
        }
    }

    private func closeManual() {
        viewModel.tearDown()
        dismiss()
    }
}

private struct PDFKitDocumentView: UIViewRepresentable {
    let document: PDFDocument
    @Binding var currentPageIndex: Int
    @Binding var requestedPageIndex: Int?
    let onRequestConsumed: () -> Void

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        configure(pdfView)
        pdfView.document = document

        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.pageChanged(_:)),
            name: Notification.Name.PDFViewPageChanged,
            object: pdfView
        )

        context.coordinator.restore(pageIndex: currentPageIndex, in: pdfView)
        return pdfView
    }

    func updateUIView(_ pdfView: PDFView, context: Context) {
        context.coordinator.currentPageIndex = $currentPageIndex
        context.coordinator.onRequestConsumed = onRequestConsumed

        if pdfView.document !== document {
            pdfView.document = document
            context.coordinator.restore(pageIndex: currentPageIndex, in: pdfView)
            return
        }

        if let requestedPageIndex {
            context.coordinator.go(to: requestedPageIndex, in: pdfView, consumeRequest: true)
        }
    }

    static func dismantleUIView(_ uiView: PDFView, coordinator: Coordinator) {
        NotificationCenter.default.removeObserver(coordinator)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(currentPageIndex: $currentPageIndex, onRequestConsumed: onRequestConsumed)
    }

    private func configure(_ pdfView: PDFView) {
        pdfView.autoScales = true
        pdfView.displayMode = .singlePage
        pdfView.displayDirection = .horizontal
        pdfView.displaysPageBreaks = false
        pdfView.backgroundColor = .black
        pdfView.usePageViewController(true, withViewOptions: nil)
    }

    final class Coordinator: NSObject {
        var currentPageIndex: Binding<Int>
        var onRequestConsumed: () -> Void
        private var isApplyingProgrammaticPage = false

        init(currentPageIndex: Binding<Int>, onRequestConsumed: @escaping () -> Void) {
            self.currentPageIndex = currentPageIndex
            self.onRequestConsumed = onRequestConsumed
        }

        func restore(pageIndex: Int, in pdfView: PDFView) {
            DispatchQueue.main.async { [weak self, weak pdfView] in
                guard let self, let pdfView else { return }
                self.go(to: pageIndex, in: pdfView, consumeRequest: false)
            }
        }

        func go(to pageIndex: Int, in pdfView: PDFView, consumeRequest: Bool) {
            guard let document = pdfView.document, document.pageCount > 0 else {
                if consumeRequest {
                    consumePendingRequest()
                }
                return
            }

            let targetPageIndex = max(0, min(pageIndex, document.pageCount - 1))
            guard let page = document.page(at: targetPageIndex) else {
                if consumeRequest {
                    consumePendingRequest()
                }
                return
            }

            isApplyingProgrammaticPage = true
            pdfView.go(to: page)
            isApplyingProgrammaticPage = false

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                if self.currentPageIndex.wrappedValue != targetPageIndex {
                    self.currentPageIndex.wrappedValue = targetPageIndex
                }

                if consumeRequest {
                    self.onRequestConsumed()
                }
            }
        }

        @objc func pageChanged(_ notification: Notification) {
            guard !isApplyingProgrammaticPage else { return }

            guard
                let pdfView = notification.object as? PDFView,
                let document = pdfView.document,
                let currentPage = pdfView.currentPage
            else {
                return
            }

            let pageIndex = document.index(for: currentPage)
            guard pageIndex != NSNotFound, pageIndex >= 0, pageIndex < document.pageCount else { return }

            if currentPageIndex.wrappedValue != pageIndex {
                currentPageIndex.wrappedValue = pageIndex
            }
        }

        private func consumePendingRequest() {
            DispatchQueue.main.async { [weak self] in
                self?.onRequestConsumed()
            }
        }
    }
}

private struct ManualErrorStateView: View {
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.largeTitle)
                .foregroundStyle(Theme.Colors.warning)

            Text(title)
                .font(.headline)
                .foregroundStyle(.white)

            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.68))
                .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .appBackground()
    }
}
