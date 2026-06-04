import UIKit

final class ExternalDisplayAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        if connectingSceneSession.role == .windowExternalDisplayNonInteractive {
            let configuration = UISceneConfiguration(
                name: "External Display",
                sessionRole: connectingSceneSession.role
            )
            configuration.delegateClass = ExternalDisplaySceneDelegate.self
            return configuration
        }

        return UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
    }
}
