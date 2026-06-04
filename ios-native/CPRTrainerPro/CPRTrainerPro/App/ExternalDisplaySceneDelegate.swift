import SwiftUI
import UIKit

@MainActor
final class ExternalDisplaySceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let window = UIWindow(windowScene: windowScene)
        window.backgroundColor = .black
        window.rootViewController = UIHostingController(
            rootView: ExternalPresentationView()
                .environmentObject(PresentationHub.shared.session)
        )
        self.window = window

        PresentationHub.shared.session.setExternalSceneConnected(true)
        window.makeKeyAndVisible()
        PresentationHub.shared.session.setExternalSceneActive(true)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        PresentationHub.shared.session.setExternalSceneActive(true)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        PresentationHub.shared.session.setExternalSceneActive(false)
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        PresentationHub.shared.session.setExternalSceneConnected(false)
        window = nil
    }
}
