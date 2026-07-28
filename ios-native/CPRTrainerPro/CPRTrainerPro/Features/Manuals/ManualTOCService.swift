import Foundation
import PDFKit

@MainActor
struct ManualTOCService {
    func entries(
        from document: PDFDocument,
        pageCount: Int
    ) -> (entries: [ManualTOCEntry], source: ManualTOCSource) {
        let outlineEntries = embeddedOutlineEntries(from: document, pageCount: pageCount)
        if !outlineEntries.isEmpty {
            return (outlineEntries, .embeddedOutline)
        }

        let pageEntries = generatedPageEntries(pageCount: pageCount)
        if !pageEntries.isEmpty {
            return (pageEntries, .generatedPages)
        }

        return ([], .unavailable)
    }

    func generatedPageEntries(pageCount: Int) -> [ManualTOCEntry] {
        guard pageCount > 0 else { return [] }

        return (0..<pageCount).map { pageIndex in
            ManualTOCEntry(
                id: "page-\(pageIndex)",
                title: "Page \(pageIndex + 1)",
                pageIndex: pageIndex,
                level: 0
            )
        }
    }

    private func embeddedOutlineEntries(from document: PDFDocument, pageCount: Int) -> [ManualTOCEntry] {
        guard let outlineRoot = document.outlineRoot else { return [] }

        var entries: [ManualTOCEntry] = []
        traverse(outlineRoot, document: document, pageCount: pageCount, level: -1, path: "root", into: &entries)
        return entries
    }

    private func traverse(
        _ outline: PDFOutline,
        document: PDFDocument,
        pageCount: Int,
        level: Int,
        path: String,
        into entries: inout [ManualTOCEntry]
    ) {
        let clampedLevel = max(0, level)
        if level >= 0, let entry = entry(from: outline, document: document, pageCount: pageCount, level: clampedLevel, path: path) {
            entries.append(entry)
        }

        let childCount = outline.numberOfChildren
        guard childCount > 0 else { return }

        for childIndex in 0..<childCount {
            guard let child = outline.child(at: childIndex) else { continue }
            traverse(
                child,
                document: document,
                pageCount: pageCount,
                level: level + 1,
                path: "\(path).\(childIndex)",
                into: &entries
            )
        }
    }

    private func entry(from outline: PDFOutline, document: PDFDocument, pageCount: Int, level: Int, path: String) -> ManualTOCEntry? {
        guard let destination = outlineDestination(for: outline), let page = destination.page else { return nil }

        let pageIndex = document.index(for: page)
        guard pageIndex >= 0, pageIndex < pageCount else { return nil }

        let trimmedTitle = (outline.label ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.shouldIncludeOutlineTitle(trimmedTitle) else { return nil }
        let title = trimmedTitle.isEmpty ? "Page \(pageIndex + 1)" : trimmedTitle

        return ManualTOCEntry(
            id: "outline-\(path)-page-\(pageIndex)",
            title: title,
            pageIndex: pageIndex,
            level: level
        )
    }

    private func outlineDestination(for outline: PDFOutline) -> PDFDestination? {
        if let destination = outline.destination {
            return destination
        }

        if let goToAction = outline.action as? PDFActionGoTo {
            return goToAction.destination
        }

        return nil
    }

    nonisolated static func shouldIncludeOutlineTitle(_ title: String) -> Bool {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
            .localizedCaseInsensitiveCompare("Untitled") != .orderedSame
    }
}
