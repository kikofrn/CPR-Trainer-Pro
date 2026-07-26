import Foundation
import WatchKit

@MainActor
final class TrainingSessionController: NSObject, ObservableObject {
    enum Phase: Equatable {
        case ready
        case starting
        case running
        case paused
        case completed
        case failed(String)
    }

    static let cadenceIntervalMilliseconds = 550

    @Published private(set) var phase: Phase = .ready

    private let cadenceQueue = DispatchQueue(
        label: "com.ehacademy.cpr-trainer-pro.watch.cadence",
        qos: .userInitiated
    )

    private var cadenceTimer: DispatchSourceTimer?
    private var runtimeSession: WKExtendedRuntimeSession?
    private var isStoppingForExit = false

    var shouldPlayMovie: Bool {
        phase != .paused
    }

    var accessibilityActionName: String {
        switch phase {
        case .ready, .completed, .failed:
            "Start training"
        case .starting:
            "Starting training"
        case .running:
            "Pause training"
        case .paused:
            "Resume training"
        }
    }

    func handlePrimaryAction() {
        switch phase {
        case .ready, .completed, .failed:
            startTraining()
        case .running:
            pauseTraining()
        case .paused:
            resumeTraining()
        case .starting:
            break
        }
    }

    func startOrResumeTraining() {
        switch phase {
        case .ready, .completed, .failed:
            startTraining()
        case .paused:
            resumeTraining()
        case .starting, .running:
            break
        }
    }

    func stopForAppExit() {
        isStoppingForExit = true
        stopCadence()

        if let runtimeSession, runtimeSession.state != .invalid {
            runtimeSession.invalidate()
        }

        runtimeSession = nil
        phase = .ready
    }

    private func startTraining() {
        guard WKApplication.shared().applicationState == .active else {
            phase = .failed("Raise your wrist and try again.")
            return
        }

        stopCadence()

        if let runtimeSession, runtimeSession.state != .invalid {
            runtimeSession.invalidate()
        }

        isStoppingForExit = false
        phase = .starting

        let session = WKExtendedRuntimeSession()
        session.delegate = self
        runtimeSession = session
        session.start()
    }

    private func pauseTraining() {
        guard phase == .running else { return }
        stopCadence()
        phase = .paused
    }

    private func resumeTraining() {
        guard
            phase == .paused,
            runtimeSession?.state == .running
        else {
            startTraining()
            return
        }

        phase = .running
        startCadence()
    }

    private func startCadence() {
        stopCadence()

        let timer = DispatchSource.makeTimerSource(queue: cadenceQueue)
        timer.schedule(
            deadline: .now(),
            repeating: .milliseconds(Self.cadenceIntervalMilliseconds),
            leeway: .milliseconds(5)
        )
        timer.setEventHandler { [weak self] in
            Task { @MainActor [weak self] in
                guard self?.phase == .running else { return }
                WKInterfaceDevice.current().play(.click)
            }
        }

        cadenceTimer = timer
        timer.activate()
    }

    private func stopCadence() {
        cadenceTimer?.setEventHandler {}
        cadenceTimer?.cancel()
        cadenceTimer = nil
    }

    private func handleSessionStarted(_ session: WKExtendedRuntimeSession) {
        guard session === runtimeSession, phase == .starting else {
            if session.state != .invalid {
                session.invalidate()
            }
            return
        }

        phase = .running
        startCadence()
    }

    private func handleSessionInvalidated(
        _ session: WKExtendedRuntimeSession,
        reason: WKExtendedRuntimeSessionInvalidationReason,
        error: Error?
    ) {
        guard session === runtimeSession else { return }

        stopCadence()
        runtimeSession = nil

        if isStoppingForExit {
            isStoppingForExit = false
            phase = .ready
            return
        }

        switch reason {
        case .expired:
            phase = .completed
        case .none, .resignedFrontmost:
            phase = .ready
        case .sessionInProgress:
            phase = .failed("A training session is already running.")
        case .suppressedBySystem:
            phase = .failed("Apple Watch could not start training right now.")
        case .error:
            phase = .failed(error?.localizedDescription ?? "Training stopped unexpectedly.")
        @unknown default:
            phase = .failed("Training stopped unexpectedly.")
        }
    }
}

extension TrainingSessionController: WKExtendedRuntimeSessionDelegate {
    nonisolated func extendedRuntimeSessionDidStart(
        _ extendedRuntimeSession: WKExtendedRuntimeSession
    ) {
        Task { @MainActor [weak self] in
            self?.handleSessionStarted(extendedRuntimeSession)
        }
    }

    nonisolated func extendedRuntimeSessionWillExpire(
        _ extendedRuntimeSession: WKExtendedRuntimeSession
    ) {
        // The invalidation callback performs the user-visible transition.
    }

    nonisolated func extendedRuntimeSession(
        _ extendedRuntimeSession: WKExtendedRuntimeSession,
        didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason,
        error: (any Error)?
    ) {
        Task { @MainActor [weak self] in
            self?.handleSessionInvalidated(
                extendedRuntimeSession,
                reason: reason,
                error: error
            )
        }
    }
}
