import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appViewModel: AppViewModel

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
        .tint(Theme.Colors.peach)
    }
}

