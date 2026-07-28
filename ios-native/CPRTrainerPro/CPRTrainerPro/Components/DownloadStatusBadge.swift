import SwiftUI

struct DownloadStatusBadge: View {
    let state: DownloadState

    var body: some View {
        Label(title, systemImage: icon)
            .font(.caption.weight(.semibold))
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.controlRadius, style: .continuous))
            .lineLimit(1)
    }

    private var title: String {
        switch state {
        case .notDownloaded:
            "Needed"
        case .queued:
            "Queued"
        case .waitingForWiFi:
            "Waiting for Wi-Fi"
        case .downloading(let progress):
            progress.percentText
        case .ready:
            "Ready"
        case .failed:
            "Retry"
        }
    }

    private var icon: String {
        switch state {
        case .notDownloaded:
            "icloud.and.arrow.down"
        case .queued:
            "clock"
        case .waitingForWiFi:
            "wifi.exclamationmark"
        case .downloading:
            "arrow.down.circle"
        case .ready:
            "checkmark.circle.fill"
        case .failed:
            "exclamationmark.triangle.fill"
        }
    }

    private var foregroundColor: Color {
        switch state {
        case .ready:
            .white
        case .failed:
            .white
        default:
            Theme.Colors.peach
        }
    }

    private var backgroundColor: Color {
        switch state {
        case .ready:
            Theme.Colors.success
        case .failed:
            Theme.Colors.failure
        default:
            Theme.Colors.elevatedSurface
        }
    }
}
