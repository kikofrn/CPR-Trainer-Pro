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
    @State private var captionsEnabled = true
    @State private var overlayControlsVisible = true
    @State private var overlayControlsHideToken = UUID()

    private var activeSlide: Slide? {
        guard slideshow.slides.indices.contains(slideIndex) else { return nil }
        return slideshow.slides[slideIndex]
    }

    private var subtitleService: SubtitleService {
        SubtitleService(storageService: storageService)
    }

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                ZStack {
                    VStack(spacing: 0) {
                        slideArea

                        if !isFullScreen {
                            controls
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                    if isFullScreen && overlayControlsVisible {
                        fullScreenToolbar(topInset: proxy.safeAreaInsets.top)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea(isFullScreen ? .all : [], edges: .all)
            }
            .appBackground()
            .navigationTitle(slideshow.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(isFullScreen ? .hidden : .visible, for: .navigationBar)
            .statusBarHidden(isFullScreen)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        closePlayer()
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 10) {
                        if activeSlide?.type == .video {
                            CaptionToggleButton(captionsEnabled: $captionsEnabled)
                        }

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
            .onChange(of: isFullScreen) { _, isFullScreen in
                overlayControlsVisible = true
                if isFullScreen {
                    scheduleFullScreenControlsHide()
                }
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

                        if captionsEnabled {
                            VStack {
                                Spacer()
                                SubtitleOverlay(text: currentSubtitleText)
                                    .padding(.horizontal, 18)
                                    .padding(.bottom, 12)
                            }
                            .allowsHitTesting(false)
                        }
                    } else {
                        missingSlideView(activeSlide)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black)
        .contentShape(Rectangle())
        .simultaneousGesture(
            DragGesture(minimumDistance: 40)
                .onEnded(handleSwipe)
        )
        .simultaneousGesture(
            TapGesture().onEnded {
                revealFullScreenControls()
            }
        )
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

    private func fullScreenToolbar(topInset: CGFloat) -> some View {
        VStack {
            HStack(spacing: 12) {
                Button("Close") {
                    closePlayer()
                }
                .font(.headline.weight(.semibold))
                .foregroundStyle(Theme.Colors.peach)
                .padding(.horizontal, 16)
                .padding(.vertical, 11)
                .background(.white.opacity(0.10))
                .clipShape(Capsule())

                Spacer(minLength: 12)

                Text(slideshow.title)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                Spacer(minLength: 12)

                HStack(spacing: 8) {
                    if activeSlide?.type == .video {
                        CaptionToggleButton(captionsEnabled: $captionsEnabled)
                    }

                    AirPlayRoutePicker()
                        .frame(width: 34, height: 34)

                    FullScreenToggleButton(isFullScreen: $isFullScreen)
                }
                .padding(6)
                .background(.black.opacity(0.52))
                .clipShape(Capsule())
            }
            .padding(.top, topInset + 10)
            .padding(.horizontal, 20)

            Spacer()
        }
        .background(
            LinearGradient(
                colors: [.black.opacity(0.68), .black.opacity(0.0)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 118),
            alignment: .top
        )
        .transition(.opacity)
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

    private func handleSwipe(_ value: DragGesture.Value) {
        let horizontalDistance = value.translation.width
        let verticalDistance = value.translation.height

        guard abs(horizontalDistance) > 58, abs(horizontalDistance) > abs(verticalDistance) * 1.25 else {
            return
        }

        if horizontalDistance < 0 {
            nextSlide()
        } else {
            previousSlide()
        }
    }

    private func closePlayer() {
        removeTimeObserver()
        videoPlayer?.pause()
        dismiss()
    }

    private func revealFullScreenControls() {
        guard isFullScreen else { return }
        withAnimation(.easeInOut(duration: 0.18)) {
            overlayControlsVisible = true
        }
        scheduleFullScreenControlsHide()
    }

    private func scheduleFullScreenControlsHide() {
        let token = UUID()
        overlayControlsHideToken = token
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            await MainActor.run {
                guard isFullScreen, overlayControlsHideToken == token else { return }
                withAnimation(.easeInOut(duration: 0.24)) {
                    overlayControlsVisible = false
                }
            }
        }
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
