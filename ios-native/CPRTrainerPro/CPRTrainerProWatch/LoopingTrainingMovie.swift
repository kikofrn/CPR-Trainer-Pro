import AVFoundation
import AVKit
import SwiftUI

struct LoopingTrainingMovie: View {
    let isPlaying: Bool

    @StateObject private var playback = LoopingTrainingPlayback()

    var body: some View {
        VideoPlayer(player: playback.player)
            .onAppear {
                playback.setPlaying(isPlaying)
            }
            .onChange(of: isPlaying) { _, shouldPlay in
                playback.setPlaying(shouldPlay)
            }
            .onDisappear {
                playback.pause()
            }
            .onReceive(
                NotificationCenter.default.publisher(
                    for: .AVPlayerItemDidPlayToEndTime
                )
            ) { notification in
                playback.loopIfNeeded(completedItem: notification.object)
            }
    }
}

@MainActor
private final class LoopingTrainingPlayback: ObservableObject {
    let player: AVPlayer

    private let item: AVPlayerItem?
    private var shouldPlay = false

    init() {
        guard let url = Bundle.main.url(
            forResource: "DummiesDoingCPR-Watch",
            withExtension: "mov"
        ) else {
            player = AVPlayer()
            item = nil
            return
        }

        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        player.actionAtItemEnd = .none

        self.player = player
        self.item = item
    }

    func setPlaying(_ shouldPlay: Bool) {
        self.shouldPlay = shouldPlay

        if shouldPlay {
            player.play()
        } else {
            player.pause()
        }
    }

    func pause() {
        shouldPlay = false
        player.pause()
    }

    func loopIfNeeded(completedItem: Any?) {
        guard
            let item,
            completedItem as AnyObject === item,
            shouldPlay
        else {
            return
        }

        player.seek(to: .zero)
        player.play()
    }
}
