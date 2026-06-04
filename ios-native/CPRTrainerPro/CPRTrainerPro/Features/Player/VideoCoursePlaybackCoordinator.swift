import AVFoundation
import Foundation

struct VideoPlaybackSpeedOption: Identifiable, Equatable {
    let rate: Float
    let title: String

    var id: Float { rate }

    static let allCases: [VideoPlaybackSpeedOption] = [
        .init(rate: 0.5, title: "0.5x"),
        .init(rate: 0.75, title: "0.75x"),
        .init(rate: 1.0, title: "1x"),
        .init(rate: 1.15, title: "1.15x"),
        .init(rate: 1.25, title: "1.25x"),
        .init(rate: 1.5, title: "1.5x"),
        .init(rate: 2.0, title: "2x")
    ]
}

@MainActor
final class VideoCoursePlaybackCoordinator: ObservableObject {
    let videoCourse: VideoCourse
    let storageService: StorageService
    let ownerID = UUID()

    @Published var selectedChapterID: Chapter.ID?
    @Published private(set) var player: AVPlayer?
    @Published private(set) var currentSubtitleText: String?
    @Published private(set) var playbackStatus: PlaybackStatus = .idle
    @Published var playbackRate: Float = 1.0 {
        didSet {
            guard abs(playbackRate - oldValue) > 0.001 else { return }
            applyPlaybackRate()
        }
    }
    @Published var captionsEnabled = false {
        didSet {
            if !captionsEnabled {
                currentSubtitleText = nil
                currentCueIndex = nil
            } else if let currentTime = player?.currentTime().seconds {
                updateSubtitle(at: currentTime)
            }

            PresentationHub.shared.session.updateCaptions(
                ownerID: ownerID,
                isEnabled: captionsEnabled,
                subtitleText: currentSubtitleText
            )
        }
    }
    @Published var continuousPlayEnabled = false {
        didSet {
            PresentationHub.shared.session.updateContinuousPlay(
                ownerID: ownerID,
                isEnabled: continuousPlayEnabled
            )
        }
    }

    private let subtitleService: SubtitleService
    private var subtitleCues: [SubtitleCue] = []
    private var currentCueIndex: Int?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var timeControlObservation: NSKeyValueObservation?
    private var itemStatusObservation: NSKeyValueObservation?
    private var hasAcquiredIdleTimer = false
    private var hasAcquiredAudioSession = false
    private var isTornDown = false

    init(videoCourse: VideoCourse, storageService: StorageService) {
        self.videoCourse = videoCourse
        self.storageService = storageService
        self.subtitleService = SubtitleService(storageService: storageService)
    }

    deinit {
        let presentationOwnerID = ownerID
        Task { @MainActor in
            PresentationHub.shared.session.endPresentation(ownerID: presentationOwnerID)
        }
    }

    var playableChapters: [Chapter] {
        videoCourse.chapters.filter { !$0.isSectionHeader }
    }

    var selectedChapter: Chapter? {
        guard let selectedChapterID else { return playableChapters.first }
        return playableChapters.first { $0.id == selectedChapterID }
    }

    var selectedChapterIndex: Int? {
        guard let selectedChapter else { return nil }
        return playableChapters.firstIndex { $0.id == selectedChapter.id }
    }

    var hasPreviousChapter: Bool {
        guard let selectedChapterIndex else { return false }
        return selectedChapterIndex > playableChapters.startIndex
    }

    var hasNextChapter: Bool {
        guard let selectedChapterIndex else { return false }
        return playableChapters.index(after: selectedChapterIndex) < playableChapters.endIndex
    }

    var selectedPlaybackSpeedTitle: String {
        VideoPlaybackSpeedOption.allCases.first { abs($0.rate - playbackRate) < 0.001 }?.title ?? "\(playbackRate)x"
    }

    func appear() {
        isTornDown = false
        attachAudioRouteObservers()

        if selectedChapterID == nil {
            selectedChapterID = playableChapters.first?.id
        }

        loadSelectedChapter()
    }

    func select(_ chapter: Chapter) {
        guard selectedChapterID != chapter.id else {
            player?.seek(to: .zero)
            play()
            return
        }

        selectedChapterID = chapter.id
        loadSelectedChapter()
    }

    func previousChapter() {
        guard let selectedChapterIndex, hasPreviousChapter else { return }
        selectedChapterID = playableChapters[playableChapters.index(before: selectedChapterIndex)].id
        loadSelectedChapter()
    }

    func nextChapter() {
        guard let selectedChapterIndex, hasNextChapter else { return }
        selectedChapterID = playableChapters[playableChapters.index(after: selectedChapterIndex)].id
        loadSelectedChapter()
    }

    func play() {
        ensurePlaybackResources()
        player?.playImmediately(atRate: playbackRate)
    }

    func pause() {
        player?.pause()
        setPlaybackStatus(.paused)
    }

    func togglePlayPause() {
        if playbackStatus == .playing || playbackStatus == .stalled {
            pause()
        } else {
            play()
        }
    }

    func selectPlaybackRate(_ rate: Float) {
        playbackRate = rate
    }

    func tearDown() {
        guard !isTornDown else { return }
        isTornDown = true

        player?.pause()
        removeTimeObserver()
        removeEndObserver()
        routeChangeObserver.map(NotificationCenter.default.removeObserver)
        interruptionObserver.map(NotificationCenter.default.removeObserver)
        routeChangeObserver = nil
        interruptionObserver = nil
        timeControlObservation?.invalidate()
        itemStatusObservation?.invalidate()
        timeControlObservation = nil
        itemStatusObservation = nil
        player?.replaceCurrentItem(with: nil)
        player = nil
        subtitleCues = []
        currentCueIndex = nil
        currentSubtitleText = nil
        playbackStatus = .idle

        if hasAcquiredAudioSession {
            PresentationHub.shared.releaseAudioSession()
            hasAcquiredAudioSession = false
        }

        if hasAcquiredIdleTimer {
            PresentationHub.shared.releaseIdleTimerDisable()
            hasAcquiredIdleTimer = false
        }

        PresentationHub.shared.session.endPresentation(ownerID: ownerID)
    }

    private func loadSelectedChapter() {
        removeTimeObserver()
        removeEndObserver()
        timeControlObservation?.invalidate()
        itemStatusObservation?.invalidate()
        timeControlObservation = nil
        itemStatusObservation = nil
        player?.pause()
        subtitleCues = []
        currentCueIndex = nil
        currentSubtitleText = nil
        setPlaybackStatus(.loading)

        guard let selectedChapter else {
            player?.replaceCurrentItem(with: nil)
            beginPresentation(player: nil, missingMessage: "No playable video chapter was found.")
            setPlaybackStatus(.failed("No playable video chapter was found."))
            return
        }

        guard
            storageService.fileExists(selectedChapter.filename),
            let url = try? storageService.localURL(for: selectedChapter.filename)
        else {
            player?.replaceCurrentItem(with: nil)
            beginPresentation(player: nil, missingMessage: "This chapter is not available in local storage yet.")
            setPlaybackStatus(.failed("This chapter is not available in local storage yet."))
            return
        }

        let playerItem = AVPlayerItem(url: url)
        playerItem.preferredForwardBufferDuration = 5

        let nextPlayer = player ?? AVPlayer()
        nextPlayer.automaticallyWaitsToMinimizeStalling = false
        nextPlayer.defaultRate = playbackRate
        nextPlayer.replaceCurrentItem(with: playerItem)
        player = nextPlayer

        subtitleCues = subtitleService.cues(forMediaFilename: selectedChapter.filename)
        attachEndObserver(to: playerItem)
        attachItemStatusObserver(to: playerItem)
        attachTimeControlObserver(to: nextPlayer)
        attachSubtitleObserver(to: nextPlayer)
        beginPresentation(player: nextPlayer, missingMessage: nil)
        play()
    }

    private func beginPresentation(player: AVPlayer?, missingMessage: String?) {
        PresentationHub.shared.session.beginVideo(
            ownerID: ownerID,
            courseTitle: videoCourse.title,
            chapterTitle: selectedChapter?.title ?? videoCourse.shortTitle,
            player: player,
            missingMessage: missingMessage,
            captionsEnabled: captionsEnabled,
            subtitleText: currentSubtitleText,
            playbackStatus: playbackStatus,
            continuousPlayEnabled: continuousPlayEnabled
        )
    }

    private func setPlaybackStatus(_ status: PlaybackStatus) {
        guard playbackStatus != status else { return }
        playbackStatus = status
        PresentationHub.shared.session.updatePlaybackStatus(ownerID: ownerID, status: status)
    }

    private func ensurePlaybackResources() {
        if !hasAcquiredIdleTimer {
            PresentationHub.shared.acquireIdleTimerDisable()
            hasAcquiredIdleTimer = true
        }

        if !hasAcquiredAudioSession {
            PresentationHub.shared.acquireAudioSession()
            hasAcquiredAudioSession = true
        }
    }

    private func applyPlaybackRate() {
        guard let player else { return }
        player.defaultRate = playbackRate

        if playbackStatus == .playing || player.rate > 0 {
            player.playImmediately(atRate: playbackRate)
        }
    }

    private func attachTimeControlObserver(to player: AVPlayer) {
        timeControlObservation = player.observe(\.timeControlStatus, options: [.initial, .new]) { [weak self] player, _ in
            Task { @MainActor [weak self] in
                self?.handleTimeControlStatus(player.timeControlStatus)
            }
        }
    }

    private func attachItemStatusObserver(to item: AVPlayerItem) {
        itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor [weak self] in
                guard item.status == .failed else { return }
                let message = item.error?.localizedDescription ?? "This video chapter could not be played."
                self?.setPlaybackStatus(.failed(message))
                if let ownerID = self?.ownerID {
                    PresentationHub.shared.session.failExternalPresentation(ownerID: ownerID, reason: message)
                }
            }
        }
    }

    private func handleTimeControlStatus(_ status: AVPlayer.TimeControlStatus) {
        switch status {
        case .paused:
            if playbackStatus != .ended {
                setPlaybackStatus(.paused)
            }
        case .playing:
            setPlaybackStatus(.playing)
        case .waitingToPlayAtSpecifiedRate:
            setPlaybackStatus(.stalled)
        @unknown default:
            break
        }
    }

    private func attachEndObserver(to item: AVPlayerItem) {
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handleChapterEnded()
            }
        }
    }

    private func attachSubtitleObserver(to player: AVPlayer) {
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.10, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            Task { @MainActor [weak self] in
                self?.updateSubtitle(at: time.seconds)
            }
        }
    }

    private func attachAudioRouteObservers() {
        guard routeChangeObserver == nil else { return }

        routeChangeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { _ in
            // Route changes are expected when AirPlay or HDMI connects. The session state stays source-of-truth.
        }

        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard
                let typeValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                let type = AVAudioSession.InterruptionType(rawValue: typeValue),
                type == .began
            else {
                return
            }

            Task { @MainActor [weak self] in
                self?.pause()
            }
        }
    }

    private func updateSubtitle(at time: TimeInterval) {
        guard captionsEnabled else {
            if currentSubtitleText != nil {
                currentSubtitleText = nil
                PresentationHub.shared.session.updateSubtitle(ownerID: ownerID, text: nil)
            }
            return
        }

        let nextText = subtitleText(at: time)
        guard currentSubtitleText != nextText else { return }
        currentSubtitleText = nextText
        PresentationHub.shared.session.updateSubtitle(ownerID: ownerID, text: nextText)
    }

    private func subtitleText(at time: TimeInterval) -> String? {
        guard !subtitleCues.isEmpty else {
            currentCueIndex = nil
            return nil
        }

        if let currentCueIndex,
           subtitleCues.indices.contains(currentCueIndex),
           subtitleCues[currentCueIndex].contains(time) {
            return subtitleCues[currentCueIndex].text
        }

        var low = subtitleCues.startIndex
        var high = subtitleCues.index(before: subtitleCues.endIndex)

        while low <= high {
            let mid = (low + high) / 2
            let cue = subtitleCues[mid]

            if time < cue.startTime {
                high = mid - 1
            } else if time > cue.endTime {
                low = mid + 1
            } else {
                currentCueIndex = mid
                return cue.text
            }
        }

        currentCueIndex = nil
        return nil
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
        PresentationHub.shared.session.updateSubtitle(ownerID: ownerID, text: nil)
        setPlaybackStatus(.ended)

        guard continuousPlayEnabled else { return }

        if hasNextChapter {
            nextChapter()
        }
    }
}
