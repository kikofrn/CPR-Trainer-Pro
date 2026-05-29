import SwiftUI

struct SendCertsView: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            VStack(spacing: 22) {
                Spacer(minLength: 18)

                Image(systemName: "safari.fill")
                    .font(.system(size: 60, weight: .semibold))
                    .foregroundStyle(Theme.Colors.peach)

                VStack(spacing: 8) {
                    Text("Send Certs")
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(.white)

                    Text("Open the EH Academy portal in the phone browser to manage classes and issue cards.")
                        .font(.body)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white.opacity(0.68))
                }

                PrimaryActionButton(
                    title: "Open Portal",
                    systemImage: "arrow.up.right.square.fill",
                    action: {
                        openURL(URLHelpers.sendCertsURL)
                    }
                )

                Spacer()
            }
            .padding(Theme.Layout.screenPadding)
            .appBackground()
            .navigationTitle("Send Certs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}
