import AVKit
import SwiftUI

struct VideoCoursePlayerView: View {
    let videoCourse: VideoCourse
    let storageService: StorageService

    @Environment(\.dismiss) private var dismiss
    @State private var selectedChapterID: Chapter.ID?
    @State private var player: AVPlayer?
    @State private var timeObserver: Any?
    @State private var endObserver: NSObjectProtocol?
    @State private var subtitleCues: [SubtitleCue] = []
    @State private var currentSubtitleText: String?
    @State private var isFullScreen = false
    @State private var captionsEnabled = true
    @State private var continuousPlayEnabled = false
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
                            chaptersPanel
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                    if playerShouldFill && overlayControlsVisible {
                        chapterControlsOverlay(bottomInset: proxy.safeAreaInsets.bottom)
                    }

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
                        ContinuousPlayToggleButton(isEnabled: $continuousPlayEnabled)

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
                removeEndObserver()
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

    private var chaptersPanel: some View {
        VStack(spacing: 0) {
            continuousPlayRow
            chaptersList
        }
    }

    private var continuousPlayRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "repeat")
                .font(.title3.weight(.semibold))
                .foregroundStyle(continuousPlayEnabled ? Theme.Colors.peach : .white.opacity(0.56))
                .frame(width: 34, height: 34)

            VStack(alignment: .leading, spacing: 2) {
                Text("Continuous Play")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.white)

                Text("Automatically advance to the next video chapter.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.58))
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            Toggle("", isOn: $continuousPlayEnabled)
                .labelsHidden()
                .tint(Theme.Colors.peach)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(Theme.Colors.surface)
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
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .listRowBackground(Theme.Colors.surface)
            .foregroundStyle(.white)
        }
        .scrollContentBackground(.hidden)
    }

    private func chapterControlsOverlay(bottomInset: CGFloat) -> some View {
        VStack {
            Spacer()

            HStack(spacing: 14) {
                chapterControlButton(systemImage: "backward.end.fill", label: "Previous chapter", isDisabled: !hasPreviousChapter) {
                    previousChapter()
                }

                VStack(spacing: 3) {
                    Text(selectedChapter?.title ?? "Video Chapter")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)

                    Text(continuousPlayEnabled ? "Continuous Play On" : "Continuous Play Off")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Theme.Colors.peach)
                }
                .frame(maxWidth: .infinity)

                ContinuousPlayToggleButton(isEnabled: $continuousPlayEnabled)

                chapterControlButton(systemImage: "forward.end.fill", label: "Next chapter", isDisabled: !hasNextChapter) {
                    nextChapter()
                }
            }
            .padding(10)
            .background(.black.opacity(0.62))
            .clipShape(Capsule())
            .padding(.horizontal, 18)
            .padding(.bottom, bottomInset + 18)
        }
        .transition(.opacity)
    }

    private func chapterControlButton(
        systemImage: String,
        label: String,
        isDisabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(isDisabled ? .white.opacity(0.30) : .white)
                .frame(width: 38, height: 38)
                .background(.white.opacity(isDisabled ? 0.06 : 0.14))
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityLabel(label)
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
                    ContinuousPlayToggleButton(isEnabled: $continuousPlayEnabled)

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
        if selectedChapterID == chapter.id {
            player?.seek(to: .zero)
            player?.play()
            return
        }

        selectedChapterID = chapter.id
    }

    private var selectedChapterIndex: Int? {
        guard let selectedChapter else { return nil }
        return playableChapters.firstIndex { $0.id == selectedChapter.id }
    }

    private var hasPreviousChapter: Bool {
        guard let selectedChapterIndex else { return false }
        return selectedChapterIndex > playableChapters.startIndex
    }

    private var hasNextChapter: Bool {
        guard let selectedChapterIndex else { return false }
        return playableChapters.index(after: selectedChapterIndex) < playableChapters.endIndex
    }

    private func previousChapter() {
        guard let selectedChapterIndex, hasPreviousChapter else { return }
        selectedChapterID = playableChapters[playableChapters.index(before: selectedChapterIndex)].id
    }

    private func nextChapter() {
        guard let selectedChapterIndex, hasNextChapter else { return }
        selectedChapterID = playableChapters[playableChapters.index(after: selectedChapterIndex)].id
    }

    private func closePlayer() {
        removeTimeObserver()
        removeEndObserver()
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
        removeEndObserver()
        player?.pause()
        subtitleCues = []
        currentSubtitleText = nil

        guard
            let selectedChapter,
            storageService.fileExists(selectedChapter.filename),
            let url = try? storageService.localURL(for: selectedChapter.filename)
        else {
            player?.replaceCurrentItem(with: nil)
            player = nil
            return
        }

        let playerItem = AVPlayerItem(url: url)
        let nextPlayer = player ?? AVPlayer()
        nextPlayer.replaceCurrentItem(with: playerItem)
        subtitleCues = subtitleService.cues(forMediaFilename: selectedChapter.filename)
        attachEndObserver(to: playerItem)
        attachSubtitleObserver(to: nextPlayer)
        player = nextPlayer
        nextPlayer.play()
    }

    private func attachEndObserver(to item: AVPlayerItem) {
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { _ in
            Task { @MainActor in
                handleChapterEnded()
            }
        }
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

    private func removeEndObserver() {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
    }

    private func handleChapterEnded() {
        currentSubtitleText = nil

        guard continuousPlayEnabled else { return }

        if hasNextChapter {
            nextChapter()
        }
    }
}
