import SwiftUI

struct PrimaryActionButton: View {
    let title: String
    let systemImage: String
    var backgroundColor = Theme.Colors.red
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.white)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.controlRadius, style: .continuous))
        .accessibilityIdentifier("primary-action-\(title)")
    }
}
