import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var appViewModel: AppViewModel
    @State private var showsLaunchExperience = true
    @State private var launchExperienceMode = LaunchExperienceMode.startup

    init() {
        Self.configureTabBarAppearance()
    }

    var body: some View {
        ZStack {
            tabContent
                .environment(\.launchExperienceTrigger) {
                    launchExperienceMode = .practice
                    withAnimation(.easeInOut(duration: 0.22)) {
                        showsLaunchExperience = true
                    }
                }

            if showsLaunchExperience {
                LaunchExperienceView(mode: launchExperienceMode) {
                    withAnimation(.easeInOut(duration: 0.22)) {
                        showsLaunchExperience = false
                    }
                }
                .transition(.opacity)
                .zIndex(10)
            }
        }
        .background(Color.black)
        .preferredColorScheme(.dark)
    }

    private var tabContent: some View {
        TabView(selection: $appViewModel.selectedTab) {
            CoursesView(courseID: .cprAED, title: "CPR/AED")
                .tabItem {
                    Label("CPR/AED", systemImage: "heart.text.square.fill")
                }
                .tag(AppTab.cprAED)

            CoursesView(courseID: .firstAid, title: "First Aid")
                .tabItem {
                    Label("First Aid", systemImage: "cross.case.fill")
                }
                .tag(AppTab.firstAid)

            ManualsView()
                .tabItem {
                    Label("Manuals", systemImage: "book.closed.fill")
                }
                .tag(AppTab.manuals)

            SendCertsView()
                .tabItem {
                    Label("Send Certs", systemImage: "safari.fill")
                }
                .tag(AppTab.sendCerts)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "questionmark.circle.fill")
                }
                .tag(AppTab.settings)
        }
        .tint(Theme.Colors.selectedTabItem)
    }
}

private enum LaunchExperienceMode: Equatable {
    case startup
    case practice
}

private extension RootView {
    static func configureTabBarAppearance() {
        let normalColor = UIColor(red: 0x2E / 255, green: 0x9D / 255, blue: 0xFA / 255, alpha: 1)
        let selectedColor = UIColor(red: 0x0B / 255, green: 0x52 / 255, blue: 0x90 / 255, alpha: 1)
        let glassRed = UIColor(red: 0.78, green: 0.02, blue: 0.06, alpha: 0.34)

        let itemAppearance = UITabBarItemAppearance()
        itemAppearance.normal.iconColor = normalColor
        itemAppearance.normal.titleTextAttributes = [
            .foregroundColor: normalColor,
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold)
        ]
        itemAppearance.selected.iconColor = selectedColor
        itemAppearance.selected.titleTextAttributes = [
            .foregroundColor: selectedColor,
            .font: UIFont.systemFont(ofSize: 10, weight: .bold)
        ]

        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
        appearance.backgroundColor = glassRed
        appearance.shadowColor = UIColor.white.withAlphaComponent(0.12)
        appearance.stackedLayoutAppearance = itemAppearance
        appearance.inlineLayoutAppearance = itemAppearance
        appearance.compactInlineLayoutAppearance = itemAppearance

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
        UITabBar.appearance().tintColor = selectedColor
        UITabBar.appearance().unselectedItemTintColor = normalColor
        UITabBar.appearance().isTranslucent = true
    }
}

private struct LaunchExperienceView: View {
    let mode: LaunchExperienceMode
    let onFinished: () -> Void

    @State private var showsLogo = false
    @State private var settlesLogo = false
    @State private var fadesOut = false

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()

                switch mode {
                case .startup:
                    startupContent(proxy: proxy)
                case .practice:
                    practiceContent(proxy: proxy)
                }
            }
            .opacity(fadesOut ? 0 : 1)
            .onAppear {
                if mode == .startup {
                    runLaunchSequence()
                } else {
                    showsLogo = true
                }
            }
        }
    }

    private func startupContent(proxy: GeometryProxy) -> some View {
        ZStack {
            dummiesAnimation(size: 160)
                .opacity(settlesLogo ? 0 : 1)
                .scaleEffect(showsLogo ? 0.72 : 1)
                .position(
                    x: proxy.size.width / 2,
                    y: showsLogo ? proxy.size.height / 2 + 86 : proxy.size.height / 2
                )

            BrandHeader(logoHeight: settlesLogo ? 66 : 100)
                .frame(maxWidth: settlesLogo ? 420 : 560)
                .position(
                    x: proxy.size.width / 2,
                    y: settlesLogo ? proxy.safeAreaInsets.top + 46 : proxy.size.height / 2 - 74
                )
                .opacity(showsLogo ? 1 : 0)
        }
    }

    private func practiceContent(proxy: GeometryProxy) -> some View {
        ZStack(alignment: .topTrailing) {
            VStack(spacing: 28) {
                HeartbeatBrandHeader(logoHeight: 110)
                    .frame(maxWidth: 560)

                dummiesAnimation(size: 188)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 28)
            .opacity(showsLogo ? 1 : 0)

            Button {
                onFinished()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.12))
                    .clipShape(Circle())
                    .overlay {
                        Circle()
                            .stroke(.white.opacity(0.16), lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close launch screen")
            .padding(.top, proxy.safeAreaInsets.top + 12)
            .padding(.trailing, 18)
        }
    }

    private func dummiesAnimation(size: CGFloat) -> some View {
        LoopingVideoView(resourceName: "DummiesDoingCPR", fileExtension: "mp4")
            .frame(width: size, height: size)
            .clipShape(Circle())
            .overlay {
                Circle()
                    .stroke(.white.opacity(0.18), lineWidth: 1)
            }
    }

    private func runLaunchSequence() {
        Task {
            try? await Task.sleep(nanoseconds: 450_000_000)
            withAnimation(.easeOut(duration: 0.45)) {
                showsLogo = true
            }

            try? await Task.sleep(nanoseconds: 1_650_000_000)
            withAnimation(.spring(response: 0.62, dampingFraction: 0.86)) {
                settlesLogo = true
            }

            try? await Task.sleep(nanoseconds: 650_000_000)
            withAnimation(.easeInOut(duration: 0.32)) {
                fadesOut = true
            }

            try? await Task.sleep(nanoseconds: 340_000_000)
            await MainActor.run {
                onFinished()
            }
        }
    }
}
