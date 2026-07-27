import SwiftUI

struct StickyBrandScrollView<Content: View>: View {
    let title: String?
    @ViewBuilder let content: () -> Content

    @Environment(\.launchExperienceTrigger) private var launchExperienceTrigger
    @State private var scrollOffset: CGFloat = 0
    @State private var initialReaderY: CGFloat?
    @State private var heartbeatTapTimes: [Date] = []

    init(
        title: String? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.content = content
    }

    var body: some View {
        ZStack(alignment: .top) {
            ScrollView {
                ScrollOffsetReader()

                VStack(alignment: .leading, spacing: 14) {
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

        return Group {
            if let title {
                HStack(spacing: 12) {
                    HeartbeatBrandHeader(
                        logoHeight: logoHeight,
                        alignment: .leading,
                        onBeat: recordHeartbeatTap
                    )
                    .frame(
                        width: logoHeight * logoAspectRatio,
                        alignment: .leading
                    )
                    .frame(minHeight: minTapTargetHeight)

                    Text(title)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                        .allowsTightening(true)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .accessibilityAddTraits(.isHeader)
                }
            } else {
                HeartbeatBrandHeader(
                    logoHeight: logoHeight,
                    onBeat: recordHeartbeatTap
                )
            }
        }
            .padding(.horizontal, Theme.Layout.screenPadding)
            .frame(maxWidth: .infinity)
            .frame(height: headerHeight)
            .background(Theme.Colors.background.ignoresSafeArea(edges: .top))
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
    private var logoAspectRatio: CGFloat { 2.4 }
    private var minTapTargetHeight: CGFloat { 44 }

    private func recordHeartbeatTap() {
        let now = Date()
        heartbeatTapTimes = (heartbeatTapTimes + [now])
            .filter { now.timeIntervalSince($0) <= 10 }

        guard heartbeatTapTimes.count >= 10 else {
            return
        }

        heartbeatTapTimes.removeAll()
        launchExperienceTrigger()
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

private struct LaunchExperienceTriggerKey: EnvironmentKey {
    static let defaultValue: () -> Void = {}
}

extension EnvironmentValues {
    var launchExperienceTrigger: () -> Void {
        get { self[LaunchExperienceTriggerKey.self] }
        set { self[LaunchExperienceTriggerKey.self] = newValue }
    }
}
