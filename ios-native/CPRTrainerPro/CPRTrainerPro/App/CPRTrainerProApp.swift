import SwiftUI

@main
struct CPRTrainerProApp: App {
    @StateObject private var appViewModel = AppViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appViewModel)
                .environmentObject(appViewModel.downloadService)
        }
    }
}
