import AVFoundation
import SwiftUI
import UIKit

struct CoursePlayerLayerView: UIViewRepresentable {
    let player: AVPlayer?
    var revision: UInt64 = 0

    func makeUIView(context: Context) -> PlayerLayerHostingView {
        let view = PlayerLayerHostingView()
        view.playerLayer.videoGravity = .resizeAspect
        view.playerLayer.backgroundColor = UIColor.black.cgColor
        view.update(player: player, revision: revision)
        return view
    }

    func updateUIView(_ uiView: PlayerLayerHostingView, context: Context) {
        uiView.update(player: player, revision: revision)
    }

    static func dismantleUIView(_ uiView: PlayerLayerHostingView, coordinator: ()) {
        uiView.playerLayer.player = nil
    }
}

final class PlayerLayerHostingView: UIView {
    private weak var intendedPlayer: AVPlayer?
    private var appliedRevision: UInt64?

    override class var layerClass: AnyClass {
        AVPlayerLayer.self
    }

    var playerLayer: AVPlayerLayer {
        layer as! AVPlayerLayer
    }

    func update(player: AVPlayer?, revision: UInt64) {
        let playerChanged = intendedPlayer !== player
        let revisionChanged = appliedRevision != revision
        intendedPlayer = player
        appliedRevision = revision

        guard playerChanged || revisionChanged || playerLayer.player !== player else {
            return
        }
        reattachPlayer(force: revisionChanged)
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil else { return }
        reattachPlayer(force: true)
    }

    private func reattachPlayer(force: Bool) {
        let player = intendedPlayer
        if force, playerLayer.player === player {
            playerLayer.player = nil
        }
        playerLayer.player = player
        playerLayer.setNeedsDisplay()
    }
}
