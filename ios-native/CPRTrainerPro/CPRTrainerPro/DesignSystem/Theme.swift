import SwiftUI

enum Theme {
    enum Colors {
        static let background = Color.black
        static let surface = Color(red: 0.09, green: 0.09, blue: 0.10)
        static let elevatedSurface = Color(red: 0.13, green: 0.12, blue: 0.13)
        static let red = Color(red: 0.72, green: 0.05, blue: 0.08)
        static let peach = Color(red: 1.00, green: 0.70, blue: 0.53)
        static let blue = Color(red: 0.15, green: 0.50, blue: 0.78)
        static let tabItem = Color(red: 0.18, green: 0.62, blue: 0.98)
        static let selectedTabItem = Color(red: 0.04, green: 0.32, blue: 0.56)
        static let success = Color(red: 0.18, green: 0.67, blue: 0.38)
        static let warning = Color(red: 0.95, green: 0.66, blue: 0.20)
        static let failure = Color(red: 0.90, green: 0.19, blue: 0.22)
    }

    enum Layout {
        static let cardRadius: CGFloat = 8
        static let controlRadius: CGFloat = 8
        static let screenPadding: CGFloat = 18
    }
}

struct AppBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Colors.background.ignoresSafeArea())
    }
}

extension View {
    func appBackground() -> some View {
        modifier(AppBackground())
    }
}
