import Foundation
import PDFKit

actor ManualSearchService {
    enum SearchError: LocalizedError {
        case documentUnavailable
        case emptyDocument

        var errorDescription: String? {
            switch self {
            case .documentUnavailable:
                "Search is unavailable for this manual."
            case .emptyDocument:
                "This manual does not contain searchable pages."
            }
        }
    }

    func buildIndex(for url: URL) async throws -> ManualSearchIndex {
        try Task.checkCancellation()

        guard let document = PDFDocument(url: url) else {
            throw SearchError.documentUnavailable
        }

        let pageCount = document.pageCount
        guard pageCount > 0 else {
            throw SearchError.emptyDocument
        }

        var pages: [ManualSearchPage] = []
        pages.reserveCapacity(pageCount)

        for pageIndex in 0..<pageCount {
            try Task.checkCancellation()

            let rawText = document.page(at: pageIndex)?.string ?? ""
            let normalizedWhitespace = rawText
                .components(separatedBy: .whitespacesAndNewlines)
                .filter { !$0.isEmpty }
                .joined(separator: " ")

            pages.append(ManualSearchPage(pageIndex: pageIndex, text: normalizedWhitespace))

            if pageIndex % 4 == 0 {
                await Task.yield()
            }
        }

        return ManualSearchIndex(pages: pages, pageCount: pageCount)
    }

    nonisolated func results(for query: String, in index: ManualSearchIndex) -> [ManualSearchResult] {
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else { return [] }

        let foldedQuery = Self.fold(trimmedQuery)
        guard !foldedQuery.isEmpty else { return [] }

        return index.pages.compactMap { page in
            let foldedText = Self.fold(page.text)
            guard let firstRange = foldedText.range(of: foldedQuery) else { return nil }

            let matchCount = Self.matchCount(for: foldedQuery, in: foldedText)
            let snippet = Self.snippet(from: page.text, foldedText: foldedText, firstRange: firstRange)

            return ManualSearchResult(
                id: "search-\(page.pageIndex)-\(foldedText.distance(from: foldedText.startIndex, to: firstRange.lowerBound))",
                pageIndex: page.pageIndex,
                pageNumber: page.pageNumber,
                snippet: snippet,
                matchCount: matchCount
            )
        }
    }

    private nonisolated static func fold(_ text: String) -> String {
        text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
    }

    private nonisolated static func matchCount(for query: String, in foldedText: String) -> Int {
        var count = 0
        var searchStart = foldedText.startIndex

        while searchStart < foldedText.endIndex,
              let range = foldedText.range(of: query, range: searchStart..<foldedText.endIndex) {
            count += 1
            searchStart = range.upperBound
        }

        return count
    }

    private nonisolated static func snippet(from text: String, foldedText: String, firstRange: Range<String.Index>) -> String {
        let matchOffset = foldedText.distance(from: foldedText.startIndex, to: firstRange.lowerBound)
        let contextLength = 72

        let lowerOffset = max(0, matchOffset - contextLength)
        let upperOffset = min(text.count, matchOffset + contextLength)

        let lowerBound = text.index(text.startIndex, offsetBy: lowerOffset, limitedBy: text.endIndex) ?? text.startIndex
        let upperBound = text.index(text.startIndex, offsetBy: upperOffset, limitedBy: text.endIndex) ?? text.endIndex

        var snippet = String(text[lowerBound..<upperBound])
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if lowerBound > text.startIndex {
            snippet = "..." + snippet
        }

        if upperBound < text.endIndex {
            snippet += "..."
        }

        return snippet.isEmpty ? "Match found on this page." : snippet
    }
}
