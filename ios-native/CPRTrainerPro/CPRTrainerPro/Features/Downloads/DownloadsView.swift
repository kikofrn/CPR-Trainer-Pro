import SwiftUI

struct DownloadsView: View {
    @EnvironmentObject private var appViewModel: AppViewModel
    @EnvironmentObject private var downloadService: DownloadService

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(appViewModel.catalog.packages) { package in
                        packageRow(package)
                    }
                }
                .padding(Theme.Layout.screenPadding)
            }
            .appBackground()
            .navigationTitle("Downloads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private func packageRow(_ package: DownloadPackage) -> some View {
        let state = downloadService.state(for: package.id)

        return HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(package.title)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)

                Text("\(package.assets.count) item\(package.assets.count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.58))

                if case .failed(let message) = state {
                    Text(message)
                        .font(.caption2)
                        .foregroundStyle(Theme.Colors.failure)
                        .lineLimit(4)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 8) {
                DownloadStatusBadge(state: state)

                Button {
                    performAction(for: package, state: state)
                } label: {
                    Image(systemName: actionIcon(for: state))
                        .font(.title3.weight(.semibold))
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.plain)
                .foregroundStyle(Theme.Colors.peach)
                .accessibilityLabel(actionLabel(for: state))
            }
        }
        .padding(16)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
    }

    private func performAction(for package: DownloadPackage, state: DownloadState) {
        switch state {
        case .ready:
            downloadService.delete(package)
        case .queued, .downloading:
            downloadService.cancel(package.id)
        case .notDownloaded, .failed:
            downloadService.enqueue(package, baseURL: appViewModel.catalog.mediaBaseURL)
        }
    }

    private func actionIcon(for state: DownloadState) -> String {
        switch state {
        case .ready:
            "trash"
        case .queued, .downloading:
            "xmark.circle"
        case .notDownloaded, .failed:
            "arrow.down.circle"
        }
    }

    private func actionLabel(for state: DownloadState) -> String {
        switch state {
        case .ready:
            "Delete package"
        case .queued, .downloading:
            "Cancel download"
        case .notDownloaded, .failed:
            "Download package"
        }
    }
}
