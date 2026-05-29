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
            VStack(spacing: 0) {
                playerArea

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
            .appBackground()
            .navigationTitle(videoCourse.shortTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        removeTimeObserver()
                        player?.pause()
                        dismiss()
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    AirPlayRoutePicker()
                        .frame(width: 34, height: 34)
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
            .onDisappear {
                removeTimeObserver()
                player?.pause()
            }
        }
    }

    @ViewBuilder
    private var playerArea: some View {
        ZStack {
            Color.black

            if let player {
                VideoPlayer(player: player)

                VStack {
                    Spacer()
                    SubtitleOverlay(text: currentSubtitleText)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 12)
                }
                .allowsHitTesting(false)
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
        .frame(maxWidth: .infinity)
        .aspectRatio(16 / 9, contentMode: .fit)
    }

    private func select(_ chapter: Chapter) {
        selectedChapterID = chapter.id
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
