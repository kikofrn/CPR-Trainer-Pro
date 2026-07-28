import SwiftUI

struct StickyBrandScrollView<Content: View>: View {
    let title: String?
    let showsBrandLogo: Bool
    let onHeaderProgressChange: ((CGFloat) -> Void)?
    @ViewBuilder let content: () -> Content

    @Environment(\.launchExperienceTrigger) private var launchExperienceTrigger
    @State private var scrollOffset: CGFloat = 0
    @State private var initialReaderY: CGFloat?
    @State private var heartbeatTapTimes: [Date] = []
    @State private var layoutSignature: StickyBrandLayoutSignature?

    init(
        title: String? = nil,
        showsBrandLogo: Bool = true,
        onHeaderProgressChange: ((CGFloat) -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.showsBrandLogo = showsBrandLogo
        self.onHeaderProgressChange = onHeaderProgressChange
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
                .padding(.top, StickyBrandHeaderMetrics.expandedHeaderHeight + 12)
                .padding(.bottom, 112)
            }
            .coordinateSpace(name: StickyBrandScrollSpace.name)
            .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
                if initialReaderY == nil {
                    initialReaderY = value
                }

                let baseline = initialReaderY ?? value
                scrollOffset = max(0, baseline - value)
                onHeaderProgressChange?(
                    StickyBrandHeaderMetrics.progress(for: scrollOffset)
                )
            }

            stickyHeader
        }
        .appBackground()
        .background {
            GeometryReader { proxy in
                Color.clear.preference(
                    key: StickyBrandLayoutPreferenceKey.self,
                    value: StickyBrandLayoutSignature(
                        size: proxy.size,
                        safeAreaInsets: proxy.safeAreaInsets
                    )
                )
            }
        }
        .onPreferenceChange(StickyBrandLayoutPreferenceKey.self) { signature in
            guard layoutSignature != signature else { return }
            let hadPreviousLayout = layoutSignature != nil
            layoutSignature = signature
            if hadPreviousLayout {
                initialReaderY = nil
                scrollOffset = 0
                onHeaderProgressChange?(0)
            }
        }
    }

    private var stickyHeader: some View {
        let progress = StickyBrandHeaderMetrics.progress(for: scrollOffset)
        let logoHeight = StickyBrandHeaderMetrics.logoHeight(for: progress)
        let headerHeight = StickyBrandHeaderMetrics.headerHeight(for: progress)

        return Group {
            if let title {
                HStack(spacing: 12) {
                    Group {
                        if showsBrandLogo {
                            HeartbeatBrandHeader(
                                logoHeight: logoHeight,
                                alignment: .leading,
                                onBeat: recordHeartbeatTap
                            )
                        } else {
                            Color.clear
                                .accessibilityHidden(true)
                        }
                    }
                    .frame(
                        width: logoHeight * StickyBrandHeaderMetrics.logoAspectRatio,
                        alignment: .leading
                    )
                    .frame(minHeight: StickyBrandHeaderMetrics.minimumTapTargetHeight)

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
                if showsBrandLogo {
                    HeartbeatBrandHeader(
                        logoHeight: logoHeight,
                        onBeat: recordHeartbeatTap
                    )
                }
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

enum StickyBrandHeaderMetrics {
    static let expandedHeaderHeight: CGFloat = 92
    static let collapsedHeaderHeight: CGFloat = 46
    static let expandedLogoHeight: CGFloat = 66
    static let collapsedLogoHeight: CGFloat = 33
    static let logoAspectRatio: CGFloat = 2.4
    static let minimumTapTargetHeight: CGFloat = 44

    static func progress(for scrollOffset: CGFloat) -> CGFloat {
        min(1, max(0, scrollOffset / 72))
    }

    static func logoHeight(for progress: CGFloat) -> CGFloat {
        expandedLogoHeight - (
            (expandedLogoHeight - collapsedLogoHeight) * progress
        )
    }

    static func headerHeight(for progress: CGFloat) -> CGFloat {
        expandedHeaderHeight - (
            (expandedHeaderHeight - collapsedHeaderHeight) * progress
        )
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

private struct StickyBrandLayoutSignature: Equatable {
    let size: CGSize
    let safeAreaInsets: EdgeInsets
}

private struct StickyBrandLayoutPreferenceKey: PreferenceKey {
    static var defaultValue = StickyBrandLayoutSignature(
        size: .zero,
        safeAreaInsets: EdgeInsets()
    )

    static func reduce(
        value: inout StickyBrandLayoutSignature,
        nextValue: () -> StickyBrandLayoutSignature
    ) {
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
