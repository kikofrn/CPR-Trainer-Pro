import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var appViewModel: AppViewModel

    init() {
        Self.configureTabBarAppearance()
    }

    var body: some View {
        TabView(selection: $appViewModel.selectedTab) {
            CoursesView()
                .tabItem {
                    Label("Courses", systemImage: "play.rectangle.fill")
                }
                .tag(AppTab.courses)

            DownloadsView()
                .tabItem {
                    Label("Downloads", systemImage: "arrow.down.circle.fill")
                }
                .tag(AppTab.downloads)

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
        }
        .tint(Theme.Colors.selectedTabItem)
        .preferredColorScheme(.dark)
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
