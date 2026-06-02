import CoreHaptics
import SwiftUI
import UIKit

struct StickyBrandScrollView<Content: View>: View {
    let title: String?
    let showsCourseSubtitle: Bool
    @ViewBuilder let content: () -> Content

    @State private var scrollOffset: CGFloat = 0
    @State private var initialReaderY: CGFloat?

    init(
        title: String? = nil,
        showsCourseSubtitle: Bool = false,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.showsCourseSubtitle = showsCourseSubtitle
        self.content = content
    }

    var body: some View {
        ZStack(alignment: .top) {
            ScrollView {
                ScrollOffsetReader()

                VStack(alignment: .leading, spacing: 14) {
                    if let title {
                        Text(title)
                            .font(.title.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if showsCourseSubtitle {
                        Text("Choose the course mode before class, download it once, then train offline with confidence.")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.70))
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                    }

                    content()
                }
                .padding(.horizontal, Theme.Layout.screenPadding)
                .padding(.top, expandedHeaderHeight + 12)
                .padding(.bottom, 112)
            }
            .coordinateSpace(name: StickyBrandScrollSpace.name)
            .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
                if initialReaderY == nil {
                    initialReaderY = value
                }

                let baseline = initialReaderY ?? value
                scrollOffset = max(0, baseline - value)
            }

            stickyHeader
        }
        .appBackground()
    }

    private var stickyHeader: some View {
        let progress = min(1, scrollOffset / 72)
        let logoHeight = expandedLogoHeight - ((expandedLogoHeight - collapsedLogoHeight) * progress)
        let headerHeight = expandedHeaderHeight - ((expandedHeaderHeight - collapsedHeaderHeight) * progress)

        return HeartbeatBrandHeader(logoHeight: logoHeight)
            .padding(.horizontal, Theme.Layout.screenPadding)
            .frame(maxWidth: .infinity)
            .frame(height: headerHeight)
            .background(Color.black.ignoresSafeArea(edges: .top))
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(height: 1)
            }
            .animation(.easeInOut(duration: 0.18), value: progress)
    }

    private var expandedHeaderHeight: CGFloat { 92 }
    private var collapsedHeaderHeight: CGFloat { 46 }
    private var expandedLogoHeight: CGFloat { 66 }
    private var collapsedLogoHeight: CGFloat { 33 }
}

private struct HeartbeatBrandHeader: View {
    let logoHeight: CGFloat

    private static let hapticPlayer = HeartbeatHapticPlayer()

    @State private var heartbeatScale: CGFloat = 1
    @State private var heartbeatGlow = false
    @State private var heartbeatTask: Task<Void, Never>?

    var body: some View {
        Button(action: triggerHeartbeat) {
            BrandHeader(logoHeight: logoHeight)
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
        .accessibilityHint("Tap repeatedly to simulate a heartbeat rhythm.")
    }

    private func triggerHeartbeat() {
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

private struct ScrollOffsetReader: View {
    var body: some View {
        GeometryReader { proxy in
            Color.clear.preference(
                key: ScrollOffsetPreferenceKey.self,
                value: proxy.frame(in: .named(StickyBrandScrollSpace.name)).minY
            )
        }
        .frame(height: 1)
    }
}

private enum StickyBrandScrollSpace {
    static let name = "sticky-brand-scroll"
}

private struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}
