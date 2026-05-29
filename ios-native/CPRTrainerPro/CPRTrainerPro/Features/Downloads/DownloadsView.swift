import SwiftUI

struct DownloadsView: View {
    @EnvironmentObject private var appViewModel: AppViewModel
    @EnvironmentObject private var downloadService: DownloadService

    var body: some View {
        NavigationStack {
            List {
                ForEach(appViewModel.catalog.packages) { package in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(package.title)
                                .font(.headline)
                            Text("\(package.assets.count) item\(package.assets.count == 1 ? "" : "s")")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        DownloadStatusBadge(state: downloadService.state(for: package.id))

                        Button {
                            if downloadService.state(for: package.id).isReady {
                                downloadService.delete(package)
                            } else {
                                downloadService.enqueue(package, baseURL: appViewModel.catalog.mediaBaseURL)
                            }
                        } label: {
                            Image(systemName: downloadService.state(for: package.id).isReady ? "trash" : "arrow.down")
                                .frame(width: 34, height: 34)
                        }
                        .buttonStyle(.borderless)
                        .foregroundStyle(Theme.Colors.peach)
                    }
                    .listRowBackground(Theme.Colors.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .appBackground()
            .navigationTitle("Downloads")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
