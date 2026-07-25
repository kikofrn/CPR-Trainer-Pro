import SwiftUI

struct DownloadsView: View {
    @EnvironmentObject private var appViewModel: AppViewModel
    @EnvironmentObject private var downloadService: DownloadService
    @State private var packagePendingDeletion: DownloadPackage?

    var body: some View {
        NavigationStack {
            StickyBrandScrollView(title: "Downloads") {
                VStack(spacing: 12) {
                    downloadAllButton

                    ForEach(appViewModel.catalog.packages) { package in
                        packageRow(package)
                    }
                }
            }
            .navigationTitle("")
            .toolbar(.hidden, for: .navigationBar)
            .alert("Delete Download?", isPresented: deleteConfirmationIsPresented) {
                Button("Cancel", role: .cancel) {
                    packagePendingDeletion = nil
                }
                Button("Delete", role: .destructive) {
                    if let package = packagePendingDeletion {
                        downloadService.delete(package)
                    }
                    packagePendingDeletion = nil
                }
            } message: {
                Text(deleteConfirmationMessage)
            }
        }
    }

    private var downloadAllButton: some View {
        let estimate = appViewModel.remainingDownloadEstimate
        let isActive = downloadService.isDownloadingAll

        return Button {
            appViewModel.downloadAllContent()
        } label: {
            HStack(spacing: 14) {
                Image(systemName: downloadAllIcon(estimate: estimate, isActive: isActive))
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.Colors.peach)
                    .frame(width: 38, height: 38)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Download All")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)

                    Text(downloadAllSubtitle(estimate: estimate, isActive: isActive))
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.64))
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.38))
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Colors.surface)
            .overlay {
                RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous)
                    .stroke(Theme.Colors.peach.opacity(0.46), lineWidth: 1)
            }
            .clipShape(
                RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous)
            )
        }
        .buttonStyle(.plain)
        .disabled(estimate == nil || isActive)
        .opacity(estimate == nil ? 0.72 : 1)
        .accessibilityLabel("Download all content")
        .accessibilityHint(downloadAllSubtitle(estimate: estimate, isActive: isActive))
    }

    private func downloadAllIcon(
        estimate: DownloadContentEstimate?,
        isActive: Bool
    ) -> String {
        if estimate == nil {
            return "checkmark.circle.fill"
        }
        return isActive ? "clock.arrow.circlepath" : "arrow.down.circle.fill"
    }

    private func downloadAllSubtitle(
        estimate: DownloadContentEstimate?,
        isActive: Bool
    ) -> String {
        if isActive {
            return "All remaining content is queued for background download."
        }
        guard let estimate else {
            return "Everything is downloaded and ready offline."
        }
        return "\(estimate.sizeText) remaining • \(estimate.durationText)"
    }

    private var deleteConfirmationIsPresented: Binding<Bool> {
        Binding(
            get: { packagePendingDeletion != nil },
            set: { isPresented in
                if !isPresented {
                    packagePendingDeletion = nil
                }
            }
        )
    }

    private var deleteConfirmationMessage: String {
        guard let package = packagePendingDeletion else {
            return "Are you sure you want to delete this download from this device?"
        }

        return "Are you sure you want to delete \(package.title) from this device?"
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

                if state.isReady, let sizeText = downloadService.downloadedSizeText(for: package) {
                    Text("Saved size: \(sizeText)")
                        .font(.caption)
                        .foregroundStyle(Theme.Colors.peach)
                }

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
            packagePendingDeletion = package
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
