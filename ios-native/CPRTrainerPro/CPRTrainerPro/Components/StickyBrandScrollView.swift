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
            let firstBeat = UIImpactFeedbackGenerator(style: .heavy)
            firstBeat.prepare()
            firstBeat.impactOccurred(intensity: 0.88)

            withAnimation(.easeOut(duration: 0.08)) {
                heartbeatScale = 1.10
                heartbeatGlow = true
            }

            try? await Task.sleep(nanoseconds: 85_000_000)
            guard !Task.isCancelled else { return }

            withAnimation(.easeInOut(duration: 0.08)) {
                heartbeatScale = 0.98
            }

            try? await Task.sleep(nanoseconds: 95_000_000)
            guard !Task.isCancelled else { return }

            let secondBeat = UIImpactFeedbackGenerator(style: .soft)
            secondBeat.prepare()
            secondBeat.impactOccurred(intensity: 0.55)

            withAnimation(.easeOut(duration: 0.09)) {
                heartbeatScale = 1.055
            }

            try? await Task.sleep(nanoseconds: 115_000_000)
            guard !Task.isCancelled else { return }

            withAnimation(.spring(response: 0.24, dampingFraction: 0.72)) {
                heartbeatScale = 1
                heartbeatGlow = false
            }
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
