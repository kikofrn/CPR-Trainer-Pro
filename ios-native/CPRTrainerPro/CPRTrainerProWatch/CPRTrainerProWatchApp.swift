import AppIntents
import SwiftUI

@main
struct CPRTrainerProWatchApp: App {
    init() {
        CPRAppShortcuts.updateAppShortcutParameters()
    }

    var body: some Scene {
        WindowGroup {
            TrainingView()
        }
    }
}

struct StartCPRTrainingIntent: AppIntent {
    static let title: LocalizedStringResource = "Start CPR Training"
    static let description = IntentDescription(
        "Opens CPR and starts the training cadence."
    )
    static let openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        VoiceTrainingRequestCenter.shared.requestStart()
        return .result()
    }
}

struct CPRAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartCPRTrainingIntent(),
            phrases: [
                "\(.applicationName)",
                "Open \(.applicationName)"
            ],
            shortTitle: "Start CPR",
            systemImageName: "heart.fill"
        )
    }

    static var shortcutTileColor: ShortcutTileColor {
        .red
    }
}

@MainActor
final class VoiceTrainingRequestCenter: ObservableObject {
    static let shared = VoiceTrainingRequestCenter()

    @Published private(set) var pendingRequestID: UUID?

    private static let expirationNanoseconds: UInt64 = 30_000_000_000
    private var requestedAtUptimeNanoseconds: UInt64?

    private init() {}

    func requestStart() {
        requestedAtUptimeNanoseconds = DispatchTime.now().uptimeNanoseconds
        pendingRequestID = UUID()
    }

    func consumeIfRecent() -> Bool {
        guard
            pendingRequestID != nil,
            let requestedAtUptimeNanoseconds
        else {
            return false
        }

        pendingRequestID = nil
        self.requestedAtUptimeNanoseconds = nil

        let now = DispatchTime.now().uptimeNanoseconds
        guard now >= requestedAtUptimeNanoseconds else {
            return false
        }

        return now - requestedAtUptimeNanoseconds <= Self.expirationNanoseconds
    }
}
