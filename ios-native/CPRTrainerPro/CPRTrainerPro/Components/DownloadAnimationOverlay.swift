import AVFoundation
import SwiftUI
import UIKit

struct DownloadAnimationOverlay: View {
    let progress: DownloadProgressSnapshot?

    var body: some View {
        ZStack {
            Rectangle()
                .fill(.black.opacity(0.56))

            VStack(spacing: 6) {
                LoopingVideoView(resourceName: "DummiesDoingCPR", fileExtension: "mp4")
                    .frame(width: 132, height: 132)
                    .clipShape(Circle())
                    .overlay {
                        Circle()
                            .stroke(.white.opacity(0.22), lineWidth: 1)
                    }

                ProgressView(value: progress?.fractionComplete ?? 0)
                    .progressViewStyle(.linear)
                    .tint(Theme.Colors.tabItem)
                    .frame(maxWidth: 190)

                Text(progressText)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white)

                if let secondaryText {
                    Text(secondaryText)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.72))
                }
            }
            .padding(8)
            .offset(y: 8)
        }
        .allowsHitTesting(false)
    }

    private var progressText: String {
        guard let progress else { return "Queued" }
        return "\(progress.percentText) downloaded"
    }

    private var secondaryText: String? {
        guard let progress else { return nil }
        return progress.etaText ?? "Estimating time..."
    }
}

struct LoopingVideoView: UIViewRepresentable {
    let resourceName: String
    let fileExtension: String

    func makeUIView(context: Context) -> PlayerUIView {
        let view = PlayerUIView()
        view.playerLayer.videoGravity = .resizeAspectFill

        guard let url = Bundle.main.url(
            forResource: "\(resourceName).\(fileExtension)",
            withExtension: nil,
            subdirectory: "Artwork"
        ) else {
            return view
        }

        let item = AVPlayerItem(url: url)
        let player = AVQueuePlayer(playerItem: item)
        player.isMuted = true
        player.actionAtItemEnd = .none
        context.coordinator.attach(player)
        context.coordinator.looper = AVPlayerLooper(player: player, templateItem: item)
        view.playerLayer.player = player
        player.play()
        return view
    }

    func updateUIView(_ uiView: PlayerUIView, context: Context) {
        uiView.playerLayer.player = context.coordinator.player
        context.coordinator.playIfActive()
    }

    static func dismantleUIView(_ uiView: PlayerUIView, coordinator: Coordinator) {
        coordinator.stop()
        uiView.playerLayer.player = nil
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        var player: AVQueuePlayer?
        var looper: AVPlayerLooper?
        private var observers: [NSObjectProtocol] = []

        func attach(_ player: AVQueuePlayer) {
            self.player = player
            observeAppLifecycleIfNeeded()
        }

        func playIfActive() {
            guard UIApplication.shared.applicationState != .background else { return }
            player?.play()
        }

        func stop() {
            player?.pause()
            observers.forEach(NotificationCenter.default.removeObserver)
            observers.removeAll()
        }

        deinit {
            stop()
        }

        private func observeAppLifecycleIfNeeded() {
            guard observers.isEmpty else { return }

            let center = NotificationCenter.default
            observers.append(
                center.addObserver(
                    forName: UIApplication.didBecomeActiveNotification,
                    object: nil,
                    queue: .main
                ) { [weak self] _ in
                    self?.playIfActive()
                }
            )
            observers.append(
                center.addObserver(
                    forName: UIApplication.willEnterForegroundNotification,
                    object: nil,
                    queue: .main
                ) { [weak self] _ in
                    self?.playIfActive()
                }
            )
            observers.append(
                center.addObserver(
                    forName: UIApplication.didEnterBackgroundNotification,
                    object: nil,
                    queue: .main
                ) { [weak self] _ in
                    self?.player?.pause()
                }
            )
        }
    }
}

final class PlayerUIView: UIView {
    override class var layerClass: AnyClass {
        AVPlayerLayer.self
    }

    var playerLayer: AVPlayerLayer {
        layer as! AVPlayerLayer
    }
}
