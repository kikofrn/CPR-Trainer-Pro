import AVFoundation
import SwiftUI
import UIKit

struct CoursePlayerLayerView: UIViewRepresentable {
    let player: AVPlayer?

    func makeUIView(context: Context) -> PlayerLayerHostingView {
        let view = PlayerLayerHostingView()
        view.playerLayer.videoGravity = .resizeAspect
        view.playerLayer.backgroundColor = UIColor.black.cgColor
        view.playerLayer.player = player
        return view
    }

    func updateUIView(_ uiView: PlayerLayerHostingView, context: Context) {
        guard uiView.playerLayer.player !== player else { return }
        uiView.playerLayer.player = player
    }

    static func dismantleUIView(_ uiView: PlayerLayerHostingView, coordinator: ()) {
        uiView.playerLayer.player = nil
    }
}

final class PlayerLayerHostingView: UIView {
    override class var layerClass: AnyClass {
        AVPlayerLayer.self
    }

    var playerLayer: AVPlayerLayer {
        layer as! AVPlayerLayer
    }
}
