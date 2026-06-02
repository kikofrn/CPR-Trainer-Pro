import CoreHaptics
import SwiftUI
import UIKit

struct BrandHeader: View {
    var logoHeight: CGFloat = 58
    var alignment: Alignment = .center
    var showsSubtitle = false

    var body: some View {
        VStack(alignment: .center, spacing: 8) {
            if let logo = Self.logoImage {
                Image(uiImage: logo)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, alignment: alignment)
                    .frame(height: logoHeight, alignment: alignment)
                    .accessibilityLabel("Everyday Hero Academy")
            } else {
                Text("Everyday Hero Academy")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(.white)
            }

            if showsSubtitle {
                Text("Choose the course mode before class, download it once, then train offline with confidence.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.70))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private static var logoImage: UIImage? {
        guard let url = Bundle.main.url(
            forResource: "EHAcademyTrainerProLogo.png",
            withExtension: nil,
            subdirectory: "Artwork"
        ) else {
            return nil
        }

        return UIImage(contentsOfFile: url.path)
    }
}

struct HeartbeatBrandHeader: View {
    var logoHeight: CGFloat = 58
    var alignment: Alignment = .center
    var onBeat: (() -> Void)?

    private static let hapticPlayer = HeartbeatHapticPlayer()

    @State private var heartbeatScale: CGFloat = 1
    @State private var heartbeatGlow = false
    @State private var heartbeatTask: Task<Void, Never>?

    var body: some View {
        Button(action: triggerHeartbeat) {
            BrandHeader(logoHeight: logoHeight, alignment: alignment)
                .scaleEffect(heartbeatScale)
                .shadow(
                    color: Theme.Colors.red.opacity(heartbeatGlow ? 0.48 : 0),
                    radius: heartbeatGlow ? 16 : 0,
                    y: heartbeatGlow ? 2 : 0
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Everyday Hero Academy heartbeat logo")
        .accessibilityHint("Tap repeatedly to practice a steady heartbeat rhythm.")
    }

    private func triggerHeartbeat() {
        onBeat?()
        heartbeatTask?.cancel()
        heartbeatTask = Task { @MainActor in
            Self.hapticPlayer.playBeat()

            heartbeatScale = 1
            heartbeatGlow = false

            withAnimation(.easeOut(duration: 0.10)) {
                heartbeatScale = 1.12
                heartbeatGlow = true
            }

            try? await Task.sleep(nanoseconds: 170_000_000)
            guard !Task.isCancelled else { return }

            withAnimation(.spring(response: 0.20, dampingFraction: 0.78)) {
                heartbeatScale = 1
                heartbeatGlow = false
            }
        }
    }
}

private final class HeartbeatHapticPlayer {
    private var engine: CHHapticEngine?
    private let fallbackGenerator = UIImpactFeedbackGenerator(style: .heavy)

    init() {
        prepareEngine()
    }

    func playBeat() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics, let engine else {
            fallbackGenerator.prepare()
            fallbackGenerator.impactOccurred(intensity: 0.82)
            return
        }

        do {
            try engine.start()

            let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.86)
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.34)
            let event = CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [intensity, sharpness],
                relativeTime: 0,
                duration: 0.18
            )
            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            fallbackGenerator.prepare()
            fallbackGenerator.impactOccurred(intensity: 0.82)
            prepareEngine()
        }
    }

    private func prepareEngine() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }

        do {
            let engine = try CHHapticEngine()
            engine.stoppedHandler = { [weak self] _ in
                self?.prepareEngine()
            }
            engine.resetHandler = { [weak self] in
                self?.prepareEngine()
            }
            try engine.start()
            self.engine = engine
        } catch {
            self.engine = nil
        }
    }
}
