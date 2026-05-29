import SwiftUI

struct PrimaryActionButton: View {
    let title: String
    let systemImage: String
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
        .background(Theme.Colors.red)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.controlRadius, style: .continuous))
        .accessibilityIdentifier("primary-action-\(title)")
    }
}

