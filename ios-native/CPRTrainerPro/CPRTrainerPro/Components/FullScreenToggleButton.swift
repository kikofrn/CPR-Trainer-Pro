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
