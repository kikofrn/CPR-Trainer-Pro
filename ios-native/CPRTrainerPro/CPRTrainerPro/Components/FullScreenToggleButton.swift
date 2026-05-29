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
                .frame(width: 34, height: 34)
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
                .frame(width: 34, height: 34)
                .background(.white.opacity(captionsEnabled ? 0.16 : 0.08))
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(captionsEnabled ? "Turn captions off" : "Turn captions on")
    }
}
