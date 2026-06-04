import Foundation

enum ManualNavigationTab: String, CaseIterable, Identifiable {
    case contents = "Contents"
    case search = "Search"
    case pages = "Pages"

    var id: String { rawValue }
}

enum ManualTOCSource: Equatable {
    case embeddedOutline
    case bundledJSON
    case generatedPages
    case unavailable

    var label: String {
        switch self {
        case .embeddedOutline:
            "PDF bookmarks"
        case .bundledJSON:
            "Manual contents"
        case .generatedPages:
            "Page list"
        case .unavailable:
            "Unavailable"
        }
    }
}

struct ManualTOCEntry: Identifiable, Equatable, Sendable {
    let id: String
    let title: String
    let pageIndex: Int
    let level: Int

    var pageNumber: Int {
        pageIndex + 1
    }

    init(id: String, title: String, pageIndex: Int, level: Int) {
        self.id = id
        self.title = title
        self.pageIndex = pageIndex
        self.level = level
    }
}

enum ManualSearchState: Equatable {
    case idle
    case indexing
    case ready
    case limitedText
    case unavailable(String)

    var statusText: String? {
        switch self {
        case .idle:
            nil
        case .indexing:
            "Preparing search..."
        case .ready:
            nil
        case .limitedText:
            "Searchable text is limited for this manual."
        case .unavailable(let message):
            message
        }
    }
}

struct ManualSearchPage: Equatable, Sendable {
    let pageIndex: Int
    let text: String

    var pageNumber: Int {
        pageIndex + 1
    }
}

struct ManualSearchIndex: Equatable, Sendable {
    let pages: [ManualSearchPage]
    let pageCount: Int

    var searchablePageCount: Int {
        pages.filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }.count
    }

    var hasLimitedText: Bool {
        guard pageCount > 0 else { return true }
        return Double(searchablePageCount) / Double(pageCount) < 0.25
    }
}

struct ManualSearchResult: Identifiable, Equatable, Sendable {
    let id: String
    let pageIndex: Int
    let pageNumber: Int
    let snippet: String
    let matchCount: Int
}
