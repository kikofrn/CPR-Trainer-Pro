import AVKit
import SwiftUI
import UIKit

struct SlideshowPlayerView: View {
    let slideshow: Slideshow
    let storageService: StorageService

    @Environment(\.dismiss) private var dismiss
    @State private var slideIndex = 0
    @State private var videoPlayer: AVPlayer?
    @State private var timeObserver: Any?
    @State private var subtitleCues: [SubtitleCue] = []
    @State private var currentSubtitleText: String?
    @State private var isFullScreen = false

    private var activeSlide: Slide? {
        guard slideshow.slides.indices.contains(slideIndex) else { return nil }
        return slideshow.slides[slideIndex]
    }

    private var subtitleService: SubtitleService {
        SubtitleService(storageService: storageService)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                slideArea

                if !isFullScreen {
                    controls
                }
            }
            .appBackground()
            .navigationTitle(slideshow.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        removeTimeObserver()
                        videoPlayer?.pause()
                        dismiss()
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 10) {
                        AirPlayRoutePicker()
                            .frame(width: 34, height: 34)

                        FullScreenToggleButton(isFullScreen: $isFullScreen)
                    }
                }
            }
            .onAppear(perform: loadActiveSlide)
            .onChange(of: slideIndex) { _, _ in
                loadActiveSlide()
            }
            .onDisappear {
                removeTimeObserver()
                videoPlayer?.pause()
            }
        }
    }

    @ViewBuilder
    private var slideArea: some View {
        ZStack {
            Color.black

            if let activeSlide {
                switch activeSlide.type {
                case .image:
                    if let image = image(for: activeSlide) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                    } else {
                        missingSlideView(activeSlide)
                    }
                case .video:
                    if let videoPlayer {
                        VideoPlayer(player: videoPlayer)

                        VStack {
                            Spacer()
                            SubtitleOverlay(text: currentSubtitleText)
                                .padding(.horizontal, 18)
                                .padding(.bottom, 12)
                        }
                        .allowsHitTesting(false)
                    } else {
                        missingSlideView(activeSlide)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black)
    }

    private var controls: some View {
        VStack(spacing: 12) {
            if let activeSlide {
                Text(activeSlide.title)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 18) {
                Button {
                    previousSlide()
                } label: {
                    Image(systemName: "chevron.left.circle.fill")
                        .font(.system(size: 36))
                }
                .disabled(slideIndex == 0)

                Text("\(slideIndex + 1) / \(slideshow.slides.count)")
                    .font(.subheadline.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white.opacity(0.74))
                    .frame(minWidth: 80)

                Button {
                    nextSlide()
                } label: {
                    Image(systemName: "chevron.right.circle.fill")
                        .font(.system(size: 36))
                }
                .disabled(slideIndex >= slideshow.slides.count - 1)
            }
            .foregroundStyle(Theme.Colors.peach)
        }
        .padding(16)
        .background(Theme.Colors.surface)
    }

    private func missingSlideView(_ slide: Slide) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.largeTitle)
                .foregroundStyle(Theme.Colors.warning)

            Text("Slide Not Available")
                .font(.headline)
                .foregroundStyle(.white)

            Text(slide.filename)
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.58))
                .padding(.horizontal)
        }
    }

    private func previousSlide() {
        guard slideIndex > 0 else { return }
        slideIndex -= 1
    }

    private func nextSlide() {
        guard slideIndex < slideshow.slides.count - 1 else { return }
        slideIndex += 1
    }

    private func loadActiveSlide() {
        removeTimeObserver()
        videoPlayer?.pause()
        videoPlayer = nil
        subtitleCues = []
        currentSubtitleText = nil

        guard
            let activeSlide,
            activeSlide.type == .video,
            storageService.fileExists(activeSlide.filename),
            let url = try? storageService.localURL(for: activeSlide.filename)
        else {
            return
        }

        let nextPlayer = AVPlayer(url: url)
        subtitleCues = subtitleService.cues(forMediaFilename: activeSlide.filename)
        attachSubtitleObserver(to: nextPlayer)
        videoPlayer = nextPlayer
        nextPlayer.play()
    }

    private func image(for slide: Slide) -> UIImage? {
        guard
            storageService.fileExists(slide.filename),
            let url = try? storageService.localURL(for: slide.filename)
        else {
            return nil
        }

        return UIImage(contentsOfFile: url.path)
    }

    private func attachSubtitleObserver(to player: AVPlayer) {
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
            queue: .main
        ) { time in
            currentSubtitleText = subtitleCues.first { $0.contains(time.seconds) }?.text
        }
    }

    private func removeTimeObserver() {
        if let timeObserver {
            videoPlayer?.removeTimeObserver(timeObserver)
            self.timeObserver = nil
        }
    }
}
