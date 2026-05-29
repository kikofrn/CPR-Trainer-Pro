import SwiftUI

struct SendCertsView: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            StickyBrandScrollView(title: "Send Certs") {
                VStack(spacing: 22) {
                    Image(systemName: "safari.fill")
                        .font(.system(size: 58, weight: .semibold))
                        .foregroundStyle(Theme.Colors.peach)

                    Text("Open the EH Academy portal in the phone browser to manage classes and issue cards.")
                        .font(.body)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white.opacity(0.68))

                    PrimaryActionButton(
                        title: "Open Portal",
                        systemImage: "arrow.up.right.square.fill",
                        action: {
                            openURL(URLHelpers.sendCertsURL)
                        }
                    )
                }
                .padding(.top, 54)
            }
            .navigationTitle("")
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}
