import SwiftUI
import WatchKit

struct LoopingTrainingMovie: WKInterfaceObjectRepresentable {
    let isPlaying: Bool

    func makeWKInterfaceObject(context: Context) -> WKInterfaceInlineMovie {
        let movie = WKInterfaceInlineMovie()
        movie.setVideoGravity(.resizeAspectFill)
        movie.setAutoplays(true)
        movie.setLoops(true)

        if let url = Bundle.main.url(
            forResource: "DummiesDoingCPR-Watch",
            withExtension: "mov"
        ) {
            movie.setMovieURL(url)
        }

        return movie
    }

    func updateWKInterfaceObject(
        _ movie: WKInterfaceInlineMovie,
        context: Context
    ) {
        if isPlaying {
            movie.play()
        } else {
            movie.pause()
        }
    }

    static func dismantleWKInterfaceObject(
        _ movie: WKInterfaceInlineMovie,
        coordinator: Void
    ) {
        movie.pause()
    }
}
