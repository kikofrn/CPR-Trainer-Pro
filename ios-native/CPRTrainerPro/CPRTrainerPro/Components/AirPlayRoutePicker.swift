import AVKit
import SwiftUI

enum AirPlayAudioOutputGuidanceAction: Equatable {
    case none
    case show
    case dismiss
}

struct AirPlayAudioOutputGuidanceTracker: Equatable {
    private(set) var activeAirPlayPortUIDs: [String] = []
    private(set) var hasShownForActiveRoute = false

    mutating func update(
        airPlayPortUIDs: [String],
        externalSceneConnected: Bool
    ) -> AirPlayAudioOutputGuidanceAction {
        let normalizedUIDs = Array(Set(airPlayPortUIDs)).sorted()

        guard !normalizedUIDs.isEmpty else {
            activeAirPlayPortUIDs = []
            hasShownForActiveRoute = false
            return .dismiss
        }

        if normalizedUIDs != activeAirPlayPortUIDs {
            activeAirPlayPortUIDs = normalizedUIDs
            hasShownForActiveRoute = false
        }

        guard !externalSceneConnected else {
            return .dismiss
        }

        guard !hasShownForActiveRoute else {
            return .none
        }

        hasShownForActiveRoute = true
        return .show
    }
}

struct AirPlayAudioOutputGuidanceBanner: View {
    static let message =
        "Course audio is routed to the selected AirPlay device. To show video on the TV, use Screen Mirroring in Control Center."

    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "speaker.wave.2.fill")
                .foregroundStyle(Theme.Colors.peach)

            Text(message)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(.black.opacity(0.88), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(.white.opacity(0.14), lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
    }
}

struct AirPlayRoutePicker: UIViewRepresentable {
    let prioritizesVideoDevices: Bool
    let accessibilityLabel: String

    init(
        prioritizesVideoDevices: Bool = false,
        accessibilityLabel: String = "Choose Audio Output"
    ) {
        self.prioritizesVideoDevices = prioritizesVideoDevices
        self.accessibilityLabel = accessibilityLabel
    }

    func makeUIView(context: Context) -> AVRoutePickerView {
        let view = AVRoutePickerView()
        view.activeTintColor = UIColor(Theme.Colors.peach)
        view.tintColor = UIColor.white
        configure(view)
        return view
    }

    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {
        configure(uiView)
    }

    private func configure(_ view: AVRoutePickerView) {
        view.prioritizesVideoDevices = prioritizesVideoDevices
        view.isAccessibilityElement = true
        view.accessibilityLabel = accessibilityLabel
        view.accessibilityHint =
            "Selects where course audio plays. Use Screen Mirroring to show course video."
    }
}
