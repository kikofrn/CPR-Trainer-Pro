import SwiftUI

@main
struct CPRTrainerProApp: App {
    @UIApplicationDelegateAdaptor(ExternalDisplayAppDelegate.self) private var appDelegate
    @StateObject private var appViewModel = AppViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appViewModel)
                .environmentObject(appViewModel.downloadService)
        }
    }
}
