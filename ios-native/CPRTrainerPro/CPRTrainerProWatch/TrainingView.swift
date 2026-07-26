import SwiftUI
import WatchKit

struct TrainingView: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var controller = TrainingSessionController()
    @StateObject private var voiceRequests = VoiceTrainingRequestCenter.shared

    var body: some View {
        Button {
            controller.handlePrimaryAction()
        } label: {
            ZStack {
                Color.black

                LoopingTrainingMovie(isPlaying: controller.shouldPlayMovie)
                    .allowsHitTesting(false)

                overlay
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .ignoresSafeArea()
        .accessibilityLabel(controller.accessibilityActionName)
        .accessibilityHint("CPR cadence is one haptic every 0.55 seconds.")
        .onAppear {
            startPendingVoiceRequestIfPossible()
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            startPendingVoiceRequestIfPossible()
        }
        .onChange(of: voiceRequests.pendingRequestID) { _, requestID in
            guard requestID != nil else { return }
            startPendingVoiceRequestIfPossible()
        }
        .onReceive(
            NotificationCenter.default.publisher(
                for: WKExtension.applicationDidBecomeActiveNotification
            )
        ) { _ in
            startPendingVoiceRequestIfPossible()
        }
        .onDisappear {
            controller.stopForAppExit()
        }
    }

    @ViewBuilder
    private var overlay: some View {
        switch controller.phase {
        case .ready:
            actionOverlay(
                icon: "play.fill",
                title: "Start Training",
                detail: "0.55-second CPR cadence"
            )
        case .starting:
            actionOverlay(
                icon: "ellipsis",
                title: "Starting…",
                detail: "Getting the rhythm ready"
            )
        case .running:
            VStack {
                Spacer()
                Text("Tap to pause")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.72))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(.black.opacity(0.42), in: Capsule())
                    .padding(.bottom, 5)
            }
        case .paused:
            actionOverlay(
                icon: "play.fill",
                title: "Paused",
                detail: "Tap to resume"
            )
        case .completed:
            actionOverlay(
                icon: "checkmark",
                title: "Session Complete",
                detail: "Tap to start another"
            )
        case .failed(let message):
            actionOverlay(
                icon: "arrow.clockwise",
                title: "Let’s Try That Again",
                detail: message
            )
        }
    }

    private func actionOverlay(
        icon: String,
        title: String,
        detail: String
    ) -> some View {
        VStack(spacing: 7) {
            Image(systemName: icon)
                .font(.title3.weight(.bold))

            Text(title)
                .font(.headline)
                .multilineTextAlignment(.center)

            Text(detail)
                .font(.caption2)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.78))
                .lineLimit(3)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.black.opacity(0.66), in: RoundedRectangle(cornerRadius: 16))
        .padding(10)
    }

    private func startPendingVoiceRequestIfPossible() {
        guard
            scenePhase == .active,
            WKApplication.shared().applicationState == .active,
            voiceRequests.consumeIfRecent()
        else {
            return
        }

        controller.startOrResumeTraining()
    }
}
