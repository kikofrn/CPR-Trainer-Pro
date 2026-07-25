import UIKit

@MainActor
final class ExternalDisplayAppDelegate: NSObject, UIApplicationDelegate {
    private static var backgroundSessionCompletionHandlers: [String: () -> Void] = [:]

    func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        Self.backgroundSessionCompletionHandlers[identifier] = completionHandler
    }

    static func completeBackgroundSessionEvents(identifier: String) {
        let completionHandler = backgroundSessionCompletionHandlers.removeValue(
            forKey: identifier
        )
        completionHandler?()
    }

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
