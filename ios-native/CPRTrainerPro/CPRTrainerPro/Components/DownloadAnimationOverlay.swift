import AVFoundation
import SwiftUI
import UIKit

struct DownloadAnimationOverlay: View {
    let progress: Double?

    var body: some View {
        ZStack {
            Rectangle()
                .fill(.black.opacity(0.46))

            VStack(spacing: 12) {
                LoopingVideoView(resourceName: "DummiesDoingCPR", fileExtension: "mp4")
                    .frame(width: 132, height: 132)
                    .clipShape(Circle())
                    .overlay {
                        Circle()
                            .stroke(.white.opacity(0.22), lineWidth: 1)
                    }

                ProgressView(value: progress ?? 0)
                    .progressViewStyle(.linear)
                    .tint(Theme.Colors.tabItem)
                    .frame(maxWidth: 190)

                Text(progressText)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white)
            }
            .padding(16)
            .background(.black.opacity(0.38))
            .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
        }
        .allowsHitTesting(false)
    }

    private var progressText: String {
        guard let progress else { return "Queued" }
        return "\(Int((progress * 100).rounded()))% downloaded"
    }
}

private struct LoopingVideoView: UIViewRepresentable {
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
        context.coordinator.player = player
        context.coordinator.looper = AVPlayerLooper(player: player, templateItem: item)
        view.playerLayer.player = player
        player.play()
        return view
    }

    func updateUIView(_ uiView: PlayerUIView, context: Context) {
        context.coordinator.player?.play()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        var player: AVQueuePlayer?
        var looper: AVPlayerLooper?
    }
}

private final class PlayerUIView: UIView {
    override class var layerClass: AnyClass {
        AVPlayerLayer.self
    }

    var playerLayer: AVPlayerLayer {
        layer as! AVPlayerLayer
    }
}
