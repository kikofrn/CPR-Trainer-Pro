import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var appViewModel: AppViewModel
    @State private var showsLaunchExperience = true

    init() {
        Self.configureTabBarAppearance()
    }

    var body: some View {
        ZStack {
            tabContent

            if showsLaunchExperience {
                LaunchExperienceView {
                    showsLaunchExperience = false
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
    let onFinished: () -> Void

    @State private var showsLogo = false
    @State private var settlesLogo = false
    @State private var fadesOut = false

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()

                LoopingVideoView(resourceName: "DummiesDoingCPR", fileExtension: "mp4")
                    .frame(width: 160, height: 160)
                    .clipShape(Circle())
                    .overlay {
                        Circle()
                            .stroke(.white.opacity(0.18), lineWidth: 1)
                    }
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
            .opacity(fadesOut ? 0 : 1)
            .onAppear(perform: runLaunchSequence)
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
