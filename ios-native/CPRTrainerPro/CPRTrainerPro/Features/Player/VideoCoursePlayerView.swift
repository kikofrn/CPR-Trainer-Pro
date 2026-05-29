import AVKit
import SwiftUI

struct VideoCoursePlayerView: View {
    let videoCourse: VideoCourse
    let storageService: StorageService

    @Environment(\.dismiss) private var dismiss
    @State private var selectedChapterID: Chapter.ID?
    @State private var player: AVPlayer?
    @State private var timeObserver: Any?
    @State private var subtitleCues: [SubtitleCue] = []
    @State private var currentSubtitleText: String?
    @State private var isFullScreen = false
    @State private var captionsEnabled = true
    @State private var overlayControlsVisible = true
    @State private var overlayControlsHideToken = UUID()

    private var playableChapters: [Chapter] {
        videoCourse.chapters.filter { !$0.isSectionHeader }
    }

    private var selectedChapter: Chapter? {
        guard let selectedChapterID else { return playableChapters.first }
        return playableChapters.first { $0.id == selectedChapterID }
    }

    private var subtitleService: SubtitleService {
        SubtitleService(storageService: storageService)
    }

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                let isLandscape = proxy.size.width > proxy.size.height
                let playerShouldFill = isLandscape || isFullScreen

                ZStack {
                    VStack(spacing: 0) {
                        playerArea(fillsAvailableSpace: playerShouldFill)

                        if !playerShouldFill {
                            chaptersList
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                    if isFullScreen && overlayControlsVisible {
                        fullScreenToolbar(topInset: proxy.safeAreaInsets.top)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea(isFullScreen ? .all : [], edges: .all)
                .simultaneousGesture(
                    TapGesture().onEnded {
                        revealFullScreenControls()
                    }
                )
            }
            .appBackground()
            .navigationTitle(videoCourse.shortTitle)
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
                        CaptionToggleButton(captionsEnabled: $captionsEnabled)

                        AirPlayRoutePicker()
                            .frame(width: 34, height: 34)

                        FullScreenToggleButton(isFullScreen: $isFullScreen)
                    }
                }
            }
            .onAppear {
                if selectedChapterID == nil {
                    selectedChapterID = playableChapters.first?.id
                }
                loadSelectedChapter()
            }
            .onChange(of: selectedChapterID) { _, _ in
                loadSelectedChapter()
            }
            .onChange(of: isFullScreen) { _, isFullScreen in
                overlayControlsVisible = true
                if isFullScreen {
                    scheduleFullScreenControlsHide()
                }
            }
            .onDisappear {
                removeTimeObserver()
                player?.pause()
            }
        }
    }

    @ViewBuilder
    private func playerArea(fillsAvailableSpace: Bool) -> some View {
        if fillsAvailableSpace {
            playerSurface
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            playerSurface
                .frame(maxWidth: .infinity)
                .aspectRatio(16 / 9, contentMode: .fit)
        }
    }

    private var playerSurface: some View {
        ZStack {
            Color.black

            if let player {
                VideoPlayer(player: player)

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
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.largeTitle)
                        .foregroundStyle(Theme.Colors.warning)

                    Text("Media Not Available")
                        .font(.headline)
                        .foregroundStyle(.white)

                    Text("This chapter is not available in local storage yet.")
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white.opacity(0.68))
                }
                .padding()
            }
        }
    }

    private var chaptersList: some View {
        List(playableChapters) { chapter in
            Button {
                select(chapter)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: selectedChapter?.id == chapter.id ? "play.circle.fill" : "circle")
                        .foregroundStyle(selectedChapter?.id == chapter.id ? Theme.Colors.peach : .secondary)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(chapter.title)
                            .font(.body.weight(.semibold))
                        if let duration = chapter.duration {
                            Text(duration)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Spacer()
                }
            }
            .listRowBackground(Theme.Colors.surface)
            .foregroundStyle(.white)
        }
        .scrollContentBackground(.hidden)
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

                Text(videoCourse.shortTitle)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                Spacer(minLength: 12)

                HStack(spacing: 8) {
                    CaptionToggleButton(captionsEnabled: $captionsEnabled)

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

    private func select(_ chapter: Chapter) {
        selectedChapterID = chapter.id
    }

    private func closePlayer() {
        removeTimeObserver()
        player?.pause()
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

    private func loadSelectedChapter() {
        removeTimeObserver()
        player?.pause()
        player = nil
        subtitleCues = []
        currentSubtitleText = nil

        guard
            let selectedChapter,
            storageService.fileExists(selectedChapter.filename),
            let url = try? storageService.localURL(for: selectedChapter.filename)
        else {
            return
        }

        let nextPlayer = AVPlayer(url: url)
        subtitleCues = subtitleService.cues(forMediaFilename: selectedChapter.filename)
        attachSubtitleObserver(to: nextPlayer)
        player = nextPlayer
        nextPlayer.play()
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
            player?.removeTimeObserver(timeObserver)
            self.timeObserver = nil
        }
    }
}
