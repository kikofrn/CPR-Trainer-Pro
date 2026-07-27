import SwiftUI

struct ManualsView: View {
    var showsBrandLogo = true
    var onHeaderProgressChange: ((CGFloat) -> Void)? = nil

    @EnvironmentObject private var appViewModel: AppViewModel
    @EnvironmentObject private var downloadService: DownloadService
    @State private var activeManual: Manual?

    var body: some View {
        NavigationStack {
            StickyBrandScrollView(
                title: "Manuals",
                showsBrandLogo: showsBrandLogo,
                onHeaderProgressChange: onHeaderProgressChange
            ) {
                VStack(spacing: 14) {
                    ForEach(appViewModel.catalog.manuals) { manual in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 12) {
                                ArtworkImage(
                                    name: manual.thumbnail,
                                    placeholderSystemName: "book.closed.fill",
                                    cornerRadius: 6
                                )
                                .frame(width: 54, height: 72)
                                .clipped()
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .stroke(.white.opacity(0.1), lineWidth: 1)
                                )

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(manual.title)
                                        .font(.headline)
                                        .foregroundStyle(.white)
                                    Text(manual.description)
                                        .font(.subheadline)
                                        .foregroundStyle(.white.opacity(0.64))
                                }

                                Spacer()

                                DownloadStatusBadge(state: downloadService.state(for: manual.packageID))
                            }

                            PrimaryActionButton(
                                title: downloadService.state(for: manual.packageID).isReady ? "Open Manual" : "Download Manual",
                                systemImage: downloadService.state(for: manual.packageID).isReady ? "book.fill" : "arrow.down.circle.fill",
                                action: {
                                    if downloadService.state(for: manual.packageID).isReady {
                                        activeManual = manual
                                        return
                                    }

                                    if let package = appViewModel.catalog.package(with: manual.packageID) {
                                        downloadService.enqueue(package, baseURL: appViewModel.catalog.mediaBaseURL)
                                    }
                                }
                            )
                        }
                        .padding(16)
                        .background(Theme.Colors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
                    }
                }
            }
            .navigationTitle("")
            .toolbar(.hidden, for: .navigationBar)
        }
        .fullScreenCover(item: $activeManual) { manual in
            ManualViewerView(
                manual: manual,
                storageService: appViewModel.storageService
            )
        }
    }
}
