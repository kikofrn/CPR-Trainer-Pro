import SwiftUI

struct FullScreenToggleButton: View {
    @Binding var isFullScreen: Bool

    var body: some View {
        Button {
            isFullScreen.toggle()
        } label: {
            Image(systemName: isFullScreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(.white.opacity(0.12))
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isFullScreen ? "Exit full screen" : "Enter full screen")
    }
}

struct CaptionToggleButton: View {
    @Binding var captionsEnabled: Bool

    var body: some View {
        Button {
            captionsEnabled.toggle()
        } label: {
            Image(systemName: captionsEnabled ? "captions.bubble.fill" : "captions.bubble")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(captionsEnabled ? .white : .white.opacity(0.58))
                .frame(width: 44, height: 44)
                .background(.white.opacity(captionsEnabled ? 0.16 : 0.08))
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(captionsEnabled ? "Turn captions off" : "Turn captions on")
    }
}

struct ContinuousPlayToggleButton: View {
    @Binding var isEnabled: Bool

    var body: some View {
        Button {
            isEnabled.toggle()
        } label: {
            Image(systemName: "repeat")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(isEnabled ? .white : .white.opacity(0.58))
                .frame(width: 44, height: 44)
                .background(.white.opacity(isEnabled ? 0.16 : 0.08))
                .clipShape(Circle())
                .overlay {
                    if isEnabled {
                        Circle()
                            .stroke(Theme.Colors.peach.opacity(0.85), lineWidth: 1)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isEnabled ? "Turn continuous play off" : "Turn continuous play on")
    }
}
