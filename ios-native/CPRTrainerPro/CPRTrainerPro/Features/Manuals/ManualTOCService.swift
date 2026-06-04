import Foundation
import PDFKit

@MainActor
struct ManualTOCService {
    func entries(from document: PDFDocument, manualID: String, pageCount: Int) -> (entries: [ManualTOCEntry], source: ManualTOCSource) {
        let outlineEntries = embeddedOutlineEntries(from: document, pageCount: pageCount)
        if !outlineEntries.isEmpty {
            return (outlineEntries, .embeddedOutline)
        }

        let jsonEntries = bundledJSONEntries(manualID: manualID, pageCount: pageCount)
        if !jsonEntries.isEmpty {
            return (jsonEntries, .bundledJSON)
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

    private func bundledJSONEntries(manualID: String, pageCount: Int) -> [ManualTOCEntry] {
        guard
            let url = Bundle.main.url(forResource: "manual-toc", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let decoded = try? JSONDecoder().decode([String: [ManualTOCJSONEntry]].self, from: data),
            let entries = decoded[manualID]
        else {
            return []
        }

        return entries.enumerated().compactMap { offset, entry in
            let pageIndex = entry.page - 1
            guard pageIndex >= 0, pageIndex < pageCount else { return nil }

            let trimmedTitle = entry.title.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedTitle.isEmpty else { return nil }

            return ManualTOCEntry(
                id: "json-\(manualID)-\(offset)-page-\(pageIndex)",
                title: trimmedTitle,
                pageIndex: pageIndex,
                level: max(0, entry.level ?? 0)
            )
        }
    }
}

private struct ManualTOCJSONEntry: Decodable {
    let title: String
    let page: Int
    let level: Int?
}
