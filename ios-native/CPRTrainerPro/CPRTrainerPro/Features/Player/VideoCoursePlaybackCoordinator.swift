import AVFoundation
import Combine
import Foundation

enum VideoCourseExternalPlaybackPolicy {
    static let featureEnabled = true

    static func shouldPreferNativeAirPlay(
        featureEnabled: Bool,
        externalSceneConnected: Bool,
        captionsEnabled: Bool,
        outputPorts: [AVAudioSession.Port]
    ) -> Bool {
        guard featureEnabled, externalSceneConnected, !captionsEnabled else {
            return false
        }

        let hasAirPlayOutput = outputPorts.contains(.airPlay)
        let hasWiredOutput = outputPorts.contains(.HDMI) || outputPorts.contains(.usbAudio)
        return hasAirPlayOutput && !hasWiredOutput
    }
}

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

struct VideoCourseScrubberProgress: Equatable {
    var currentTime: TimeInterval = 0
    var duration: TimeInterval = 0
    var previewTime: TimeInterval?
    var isScrubbing = false
    var wasPlaybackActiveBeforeScrub = false
    var activeSeekToken = 0
    var canSeek = false

    var displayedScrubberTime: TimeInterval {
        previewTime ?? currentTime
    }

    var sliderValue: TimeInterval {
        Self.clampedDisplayValue(displayedScrubberTime, duration: duration)
    }

    var sliderRange: ClosedRange<TimeInterval> {
        0...max(0.1, duration)
    }

    var elapsedText: String {
        Self.formattedTime(sliderValue)
    }

    var remainingText: String {
        Self.formattedRemainingTime(duration: duration, currentTime: sliderValue)
    }

    var accessibilityValue: String {
        "Elapsed \(elapsedText), remaining \(remainingText.replacingOccurrences(of: "-", with: ""))"
    }

    @discardableResult
    mutating func updatePreviewIfScrubbing(to value: TimeInterval) -> Bool {
        guard isScrubbing else { return false }
        previewTime = Self.clampedDisplayValue(value, duration: duration)
        return true
    }

    static func sanitizedDuration(_ duration: TimeInterval) -> TimeInterval? {
        guard duration.isFinite, duration > 0 else { return nil }
        return duration
    }

    static func clampedDisplayValue(_ value: TimeInterval, duration: TimeInterval) -> TimeInterval {
        guard value.isFinite else { return 0 }
        return min(max(0, value), max(0, duration))
    }

    static func clampedSeekTarget(_ value: TimeInterval, duration: TimeInterval) -> TimeInterval {
        guard value.isFinite, let duration = sanitizedDuration(duration) else { return 0 }
        return min(max(0, value), max(0, duration - 0.1))
    }

    static func formattedTime(_ time: TimeInterval) -> String {
        let totalSeconds = max(0, Int(floor(time)))
        let hours = totalSeconds / 3_600
        let minutes = (totalSeconds % 3_600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return "\(hours):\(String(format: "%02d", minutes)):\(String(format: "%02d", seconds))"
        }

        return "\(minutes):\(String(format: "%02d", seconds))"
    }

    static func formattedRemainingTime(duration: TimeInterval, currentTime: TimeInterval) -> String {
        let remaining = duration - currentTime
        let remainingSeconds = Int(floor(max(0, remaining)))
        guard remainingSeconds > 0 else { return "0:00" }
        return "-\(formattedTime(TimeInterval(remainingSeconds)))"
    }
}

struct VideoCourseScrubberSeekContext: Equatable {
    let token: Int
    let chapterID: Chapter.ID
    let itemID: ObjectIdentifier

    func isCurrent(
        activeToken: Int,
        currentChapterID: Chapter.ID?,
        currentItemID: ObjectIdentifier?
    ) -> Bool {
        token == activeToken &&
            chapterID == currentChapterID &&
            itemID == currentItemID
    }
}

@MainActor
final class VideoCoursePlaybackCoordinator: ObservableObject {
    let videoCourse: VideoCourse
    let storageService: StorageService
    let ownerID = UUID()

    @Published var selectedChapterID: Chapter.ID? {
        didSet {
            if let selectedChapterID {
                UserDefaults.standard.set(
                    selectedChapterID,
                    forKey: "videoCourse.lastChapter.\(videoCourse.id)"
                )
            }
        }
    }
    @Published private(set) var player: AVPlayer?
    @Published private(set) var currentSubtitleText: String?
    @Published private(set) var playbackStatus: PlaybackStatus = .idle
    @Published private(set) var scrubberProgress = VideoCourseScrubberProgress()
    @Published private(set) var isExternalPlaybackActive = false
    @Published var playbackRate: Float = 1.0 {
        didSet {
            guard abs(playbackRate - oldValue) > 0.001 else { return }
            applyPlaybackRate()
        }
    }
    @Published var captionsEnabled = false {
        didSet {
            UserDefaults.standard.set(
                captionsEnabled,
                forKey: "videoCourse.captions.\(videoCourse.id)"
            )
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
            applyNativeAirPlayPreference()
        }
    }
    @Published var continuousPlayEnabled = false {
        didSet {
            UserDefaults.standard.set(
                continuousPlayEnabled,
                forKey: "videoCourse.continuousPlay.\(videoCourse.id)"
            )
            PresentationHub.shared.session.updateContinuousPlay(
                ownerID: ownerID,
                isEnabled: continuousPlayEnabled
            )
        }
    }

    private let subtitleService: SubtitleService
    private var subtitleCues: [SubtitleCue] = []
    private var subtitleTask: Task<Void, Never>?
    private var subtitleGeneration = 0
    private var currentCueIndex: Int?
    private var timeObserver: Any?
    private var scrubberTimeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var presentationStateObservation: AnyCancellable?
    private var timeControlObservation: NSKeyValueObservation?
    private var itemStatusObservation: NSKeyValueObservation?
    private var externalPlaybackObservation: NSKeyValueObservation?
    private var hasAcquiredIdleTimer = false
    private var hasAcquiredAudioSession = false
    private var isTornDown = false
    private var wasPlayingBeforeInterruption = false

    init(videoCourse: VideoCourse, storageService: StorageService) {
        self.videoCourse = videoCourse
        self.storageService = storageService
        self.subtitleService = SubtitleService(storageService: storageService)
        let defaults = UserDefaults.standard
        self.captionsEnabled = defaults.bool(
            forKey: "videoCourse.captions.\(videoCourse.id)"
        )
        self.continuousPlayEnabled = defaults.bool(
            forKey: "videoCourse.continuousPlay.\(videoCourse.id)"
        )
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

    var canShowScrubber: Bool {
        scrubberProgress.canSeek
    }

    var scrubberSliderValue: TimeInterval {
        scrubberProgress.sliderValue
    }

    var scrubberSliderRange: ClosedRange<TimeInterval> {
        scrubberProgress.sliderRange
    }

    var scrubberElapsedTimeText: String {
        scrubberProgress.elapsedText
    }

    var scrubberRemainingTimeText: String {
        scrubberProgress.remainingText
    }

    var scrubberAccessibilityValue: String {
        scrubberProgress.accessibilityValue
    }

    func appear() {
        isTornDown = false
        attachPresentationStateObserver()
        attachAudioRouteObservers()

        if selectedChapterID == nil {
            let savedID = UserDefaults.standard.string(
                forKey: "videoCourse.lastChapter.\(videoCourse.id)"
            )
            selectedChapterID = playableChapters.first {
                $0.id == savedID
            }?.id ?? playableChapters.first?.id
        }

        loadSelectedChapter()
    }

    func select(_ chapter: Chapter) {
        guard selectedChapterID != chapter.id else {
            cancelScrubbing(restorePlayback: false)
            invalidatePendingScrubSeek()
            player?.seek(to: .zero)
            updateScrubberProgress(from: player, time: 0)
            updateSubtitle(at: 0)
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
        guard let player else { return }
        if playbackStatus == .ended {
            player.seek(to: .zero) { [weak self, weak player] finished in
                guard finished else { return }
                Task { @MainActor [weak self, weak player] in
                    guard let self, let player else { return }
                    self.updateScrubberProgress(from: player, time: 0)
                    player.playImmediately(atRate: self.playbackRate)
                }
            }
        } else {
            player.playImmediately(atRate: playbackRate)
        }
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

    func beginScrubbing() {
        guard scrubberProgress.canSeek, let player else { return }

        invalidatePendingScrubSeek()
        var nextProgress = scrubberProgress
        nextProgress.isScrubbing = true
        nextProgress.wasPlaybackActiveBeforeScrub = player.timeControlStatus == .playing ||
            player.timeControlStatus == .waitingToPlayAtSpecifiedRate
        nextProgress.previewTime = nextProgress.sliderValue
        scrubberProgress = nextProgress

        player.pause()
    }

    func updateScrubPreview(to value: TimeInterval) {
        var nextProgress = scrubberProgress
        guard nextProgress.updatePreviewIfScrubbing(to: value) else { return }
        scrubberProgress = nextProgress
    }

    func endScrubbing(to value: TimeInterval?) {
        guard scrubberProgress.isScrubbing else { return }
        guard scrubberProgress.canSeek,
              let player,
              let seekItem = player.currentItem,
              let selectedChapterID
        else {
            cancelScrubbing(restorePlayback: false)
            return
        }

        let proposedTarget = value ?? scrubberProgress.displayedScrubberTime
        let target = VideoCourseScrubberProgress.clampedSeekTarget(
            proposedTarget,
            duration: scrubberProgress.duration
        )
        let shouldResume = scrubberProgress.wasPlaybackActiveBeforeScrub

        var nextProgress = scrubberProgress
        nextProgress.activeSeekToken += 1
        nextProgress.previewTime = target
        scrubberProgress = nextProgress

        let seekContext = VideoCourseScrubberSeekContext(
            token: nextProgress.activeSeekToken,
            chapterID: selectedChapterID,
            itemID: ObjectIdentifier(seekItem)
        )
        let seekTime = CMTime(seconds: target, preferredTimescale: 600)

        player.seek(
            to: seekTime,
            toleranceBefore: .zero,
            toleranceAfter: .zero
        ) { [weak self] finished in
            Task { @MainActor [weak self] in
                self?.completeScrubSeek(
                    finished: finished,
                    target: target,
                    shouldResume: shouldResume,
                    context: seekContext
                )
            }
        }
    }

    func cancelScrubbing(restorePlayback: Bool) {
        guard scrubberProgress.isScrubbing else { return }

        let shouldRestorePlayback = restorePlayback && scrubberProgress.wasPlaybackActiveBeforeScrub
        var nextProgress = scrubberProgress
        nextProgress.isScrubbing = false
        nextProgress.previewTime = nil
        nextProgress.wasPlaybackActiveBeforeScrub = false
        nextProgress.activeSeekToken += 1
        scrubberProgress = nextProgress

        if shouldRestorePlayback {
            ensurePlaybackResources()
            player?.playImmediately(atRate: playbackRate)
        }
    }

    func tearDown() {
        guard !isTornDown else { return }
        isTornDown = true

        cancelScrubbing(restorePlayback: false)
        player?.pause()
        removeScrubberTimeObserver()
        removeTimeObserver()
        removeEndObserver()
        routeChangeObserver.map(NotificationCenter.default.removeObserver)
        interruptionObserver.map(NotificationCenter.default.removeObserver)
        routeChangeObserver = nil
        interruptionObserver = nil
        presentationStateObservation?.cancel()
        presentationStateObservation = nil
        timeControlObservation?.invalidate()
        itemStatusObservation?.invalidate()
        externalPlaybackObservation?.invalidate()
        timeControlObservation = nil
        itemStatusObservation = nil
        externalPlaybackObservation = nil
        player?.replaceCurrentItem(with: nil)
        player = nil
        isExternalPlaybackActive = false
        subtitleTask?.cancel()
        subtitleTask = nil
        subtitleCues = []
        subtitleGeneration += 1
        currentCueIndex = nil
        currentSubtitleText = nil
        resetScrubberState()
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
        subtitleGeneration += 1
        subtitleTask?.cancel()
        subtitleTask = nil
        cancelScrubbing(restorePlayback: false)
        removeScrubberTimeObserver()
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
        resetScrubberState()
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

        let isNewPlayer = player == nil
        let nextPlayer = player ?? AVPlayer()
        nextPlayer.automaticallyWaitsToMinimizeStalling = false
        nextPlayer.defaultRate = playbackRate
        applyNativeAirPlayPreference(to: nextPlayer)
        nextPlayer.replaceCurrentItem(with: playerItem)
        player = nextPlayer
        if isNewPlayer {
            attachExternalPlaybackObserver(to: nextPlayer)
        }

        let generation = subtitleGeneration
        let subtitleService = subtitleService
        let subtitleFilename = selectedChapter.filename
        subtitleTask = Task { [weak self] in
            let cues = await subtitleService.cuesAsync(
                forMediaFilename: subtitleFilename
            )
            guard !Task.isCancelled,
                  let self,
                  generation == self.subtitleGeneration
            else { return }
            self.subtitleCues = cues
            self.currentCueIndex = nil
            self.updateSubtitle(at: self.player?.currentTime().seconds ?? 0)
        }
        attachEndObserver(to: playerItem)
        attachItemStatusObserver(to: playerItem)
        attachTimeControlObserver(to: nextPlayer)
        attachSubtitleObserver(to: nextPlayer)
        attachScrubberTimeObserver(to: nextPlayer)
        updateScrubberProgress(from: nextPlayer, time: nextPlayer.currentTime().seconds)
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
            continuousPlayEnabled: continuousPlayEnabled,
            isExternalPlaybackActive: player != nil && isExternalPlaybackActive
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

        guard !scrubberProgress.isScrubbing else { return }

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

    private func attachExternalPlaybackObserver(to player: AVPlayer) {
        externalPlaybackObservation?.invalidate()
        externalPlaybackObservation = player.observe(
            \.isExternalPlaybackActive,
            options: [.initial, .new]
        ) { [weak self] observedPlayer, _ in
            let isActive = observedPlayer.isExternalPlaybackActive
            Task { @MainActor [weak self, weak observedPlayer] in
                guard
                    let self,
                    let observedPlayer,
                    !self.isTornDown,
                    self.player === observedPlayer
                else { return }

                self.updateExternalPlaybackState(isActive)
            }
        }
    }

    private func updateExternalPlaybackState(_ isActive: Bool) {
        guard isExternalPlaybackActive != isActive else { return }
        isExternalPlaybackActive = isActive
        PresentationHub.shared.session.updateVideoExternalPlayback(
            ownerID: ownerID,
            isActive: isActive
        )
    }

    private func attachItemStatusObserver(to item: AVPlayerItem) {
        itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor [weak self] in
                switch item.status {
                case .readyToPlay:
                    self?.updateScrubberProgress(from: self?.player, time: self?.player?.currentTime().seconds ?? 0)
                case .failed:
                    let message = item.error?.localizedDescription ?? "This video chapter could not be played."
                    self?.resetScrubberState()
                    self?.setPlaybackStatus(.failed(message))
                    if let ownerID = self?.ownerID {
                        PresentationHub.shared.session.failExternalPresentation(ownerID: ownerID, reason: message)
                    }
                case .unknown:
                    break
                @unknown default:
                    break
                }
            }
        }
    }

    private func handleTimeControlStatus(_ status: AVPlayer.TimeControlStatus) {
        switch status {
        case .paused:
            if !scrubberProgress.isScrubbing, playbackStatus != .ended {
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

    private func attachScrubberTimeObserver(to player: AVPlayer) {
        scrubberTimeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.50, preferredTimescale: 600),
            queue: .main
        ) { [weak self, weak player] time in
            Task { @MainActor [weak self, weak player] in
                self?.updateScrubberProgress(from: player, time: time.seconds)
            }
        }
    }

    private func attachAudioRouteObservers() {
        guard routeChangeObserver == nil else { return }

        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            Task { @MainActor [weak self] in
                guard let self,
                      let typeValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                      let type = AVAudioSession.InterruptionType(rawValue: typeValue)
                else { return }

                switch type {
                case .began:
                    self.wasPlayingBeforeInterruption =
                        self.player?.timeControlStatus == .playing
                    self.cancelScrubbing(restorePlayback: false)
                    self.pause()
                case .ended:
                    let optionsValue =
                        notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
                    let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                    if self.wasPlayingBeforeInterruption, options.contains(.shouldResume) {
                        self.ensurePlaybackResources()
                        self.play()
                    }
                    self.wasPlayingBeforeInterruption = false
                @unknown default:
                    break
                }
            }
        }

        routeChangeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.applyNativeAirPlayPreference()

                guard
                    let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                    AVAudioSession.RouteChangeReason(rawValue: reasonValue) == .oldDeviceUnavailable
                else { return }

                self.wasPlayingBeforeInterruption = false
                self.pause()
            }
        }
    }

    private func attachPresentationStateObserver() {
        guard presentationStateObservation == nil else { return }

        presentationStateObservation = PresentationHub.shared.session.$state
            .map(\.externalSceneConnected)
            .removeDuplicates()
            .sink { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.applyNativeAirPlayPreference()
                }
            }
    }

    private func applyNativeAirPlayPreference(to targetPlayer: AVPlayer? = nil) {
        let outputPorts = AVAudioSession.sharedInstance().currentRoute.outputs.map(\.portType)
        let shouldPreferNativeAirPlay =
            VideoCourseExternalPlaybackPolicy.shouldPreferNativeAirPlay(
                featureEnabled: VideoCourseExternalPlaybackPolicy.featureEnabled,
                externalSceneConnected:
                    PresentationHub.shared.session.state.externalSceneConnected,
                captionsEnabled: captionsEnabled,
                outputPorts: outputPorts
            )

        (targetPlayer ?? player)?
            .usesExternalPlaybackWhileExternalScreenIsActive = shouldPreferNativeAirPlay
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

    private func updateScrubberProgress(from player: AVPlayer?, time: TimeInterval) {
        guard !scrubberProgress.isScrubbing else { return }

        let duration = validDuration(for: player?.currentItem)
        var nextProgress = scrubberProgress

        if let duration {
            nextProgress.duration = duration
            nextProgress.currentTime = VideoCourseScrubberProgress.clampedDisplayValue(time, duration: duration)
            nextProgress.canSeek = true
        } else {
            nextProgress.duration = 0
            nextProgress.currentTime = VideoCourseScrubberProgress.clampedDisplayValue(time, duration: 0)
            nextProgress.canSeek = false
        }

        nextProgress.previewTime = nil
        scrubberProgress = nextProgress
    }

    private func validDuration(for item: AVPlayerItem?) -> TimeInterval? {
        guard let item else { return nil }
        let duration = item.duration
        guard duration.isValid, !duration.isIndefinite else { return nil }
        return VideoCourseScrubberProgress.sanitizedDuration(duration.seconds)
    }

    private func completeScrubSeek(
        finished: Bool,
        target: TimeInterval,
        shouldResume: Bool,
        context: VideoCourseScrubberSeekContext
    ) {
        let currentItemID = player?.currentItem.map(ObjectIdentifier.init)
        guard context.isCurrent(
            activeToken: scrubberProgress.activeSeekToken,
            currentChapterID: selectedChapterID,
            currentItemID: currentItemID
        ) else {
            return
        }

        guard finished else {
            var nextProgress = scrubberProgress
            nextProgress.isScrubbing = false
            nextProgress.previewTime = nil
            nextProgress.wasPlaybackActiveBeforeScrub = false
            scrubberProgress = nextProgress
            setPlaybackStatus(.paused)
            return
        }

        let currentDuration = validDuration(for: player?.currentItem) ?? scrubberProgress.duration
        var nextProgress = scrubberProgress
        nextProgress.currentTime = VideoCourseScrubberProgress.clampedDisplayValue(target, duration: currentDuration)
        nextProgress.duration = currentDuration
        nextProgress.canSeek = VideoCourseScrubberProgress.sanitizedDuration(currentDuration) != nil
        nextProgress.isScrubbing = false
        nextProgress.previewTime = nil
        nextProgress.wasPlaybackActiveBeforeScrub = false
        scrubberProgress = nextProgress

        updateSubtitle(at: target)

        if shouldResume {
            ensurePlaybackResources()
            player?.playImmediately(atRate: playbackRate)
        }
    }

    private func resetScrubberState() {
        var nextProgress = VideoCourseScrubberProgress()
        nextProgress.activeSeekToken = scrubberProgress.activeSeekToken + 1
        scrubberProgress = nextProgress
    }

    private func invalidatePendingScrubSeek() {
        var nextProgress = scrubberProgress
        nextProgress.activeSeekToken += 1
        scrubberProgress = nextProgress
    }

    private func removeTimeObserver() {
        if let timeObserver {
            player?.removeTimeObserver(timeObserver)
            self.timeObserver = nil
        }
    }

    private func removeScrubberTimeObserver() {
        if let scrubberTimeObserver {
            player?.removeTimeObserver(scrubberTimeObserver)
            self.scrubberTimeObserver = nil
        }
    }

    private func removeEndObserver() {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
    }

    private func handleChapterEnded() {
        cancelScrubbing(restorePlayback: false)
        currentSubtitleText = nil
        PresentationHub.shared.session.updateSubtitle(ownerID: ownerID, text: nil)
        resetScrubberState()
        setPlaybackStatus(.ended)

        guard continuousPlayEnabled else { return }

        if hasNextChapter {
            nextChapter()
        }
    }
}
