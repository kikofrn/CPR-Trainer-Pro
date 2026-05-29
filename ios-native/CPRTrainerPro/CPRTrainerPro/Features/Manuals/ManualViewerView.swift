import PDFKit
import SwiftUI

struct ManualViewerView: View {
    let manual: Manual
    let storageService: StorageService

    @Environment(\.dismiss) private var dismiss
    @State private var pageIndex: Int

    init(manual: Manual, storageService: StorageService) {
        self.manual = manual
        self.storageService = storageService
        _pageIndex = State(initialValue: UserDefaults.standard.integer(forKey: Self.pageKey(for: manual.id)))
    }

    var body: some View {
        NavigationStack {
            Group {
                if let url = localManualURL {
                    PDFKitDocumentView(url: url, pageIndex: $pageIndex)
                        .ignoresSafeArea(edges: .bottom)
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.largeTitle)
                            .foregroundStyle(Theme.Colors.warning)

                        Text("Manual Not Available")
                            .font(.headline)
                            .foregroundStyle(.white)

                        Text("This manual is not available in local storage yet.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.68))
                    }
                    .appBackground()
                }
            }
            .navigationTitle(manual.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }
            }
            .onChange(of: pageIndex) { _, newValue in
                UserDefaults.standard.set(newValue, forKey: Self.pageKey(for: manual.id))
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

    private static func pageKey(for manualID: String) -> String {
        "manual.lastPage.\(manualID)"
    }
}

private struct PDFKitDocumentView: UIViewRepresentable {
    let url: URL
    @Binding var pageIndex: Int

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.backgroundColor = .black

        if let document = PDFDocument(url: url) {
            pdfView.document = document
            if let page = document.page(at: pageIndex) {
                pdfView.go(to: page)
            }
        }

        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.pageChanged(_:)),
            name: Notification.Name.PDFViewPageChanged,
            object: pdfView
        )

        return pdfView
    }

    func updateUIView(_ pdfView: PDFView, context: Context) {
        guard pdfView.document?.documentURL != url else { return }
        pdfView.document = PDFDocument(url: url)
    }

    static func dismantleUIView(_ uiView: PDFView, coordinator: Coordinator) {
        NotificationCenter.default.removeObserver(coordinator)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(pageIndex: $pageIndex)
    }

    final class Coordinator: NSObject {
        @Binding private var pageIndex: Int

        init(pageIndex: Binding<Int>) {
            _pageIndex = pageIndex
        }

        @objc func pageChanged(_ notification: Notification) {
            guard
                let pdfView = notification.object as? PDFView,
                let document = pdfView.document,
                let currentPage = pdfView.currentPage
            else {
                return
            }

            pageIndex = document.index(for: currentPage)
        }
    }
}

