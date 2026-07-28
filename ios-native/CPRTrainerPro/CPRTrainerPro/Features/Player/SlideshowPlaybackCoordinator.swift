import AVFoundation
import Foundation
import ImageIO
import UIKit

@MainActor
final class SlideshowPlaybackCoordinator: ObservableObject {
    let slideshow: Slideshow
    let storageService: StorageService
    let ownerID = UUID()

    @Published private(set) var slideIndex = 0 {
        didSet {
            UserDefaults.standard.set(
                slideIndex,
                forKey: "slideshow.lastSlide.\(slideshow.id)"
            )
        }
    }
    @Published private(set) var videoPlayer: AVPlayer?
    @Published private(set) var currentImage: UIImage?
    @Published private(set) var currentSubtitleText: String?
    @Published private(set) var playbackStatus: PlaybackStatus = .idle
    @Published var captionsEnabled = true {
        didSet {
            UserDefaults.standard.set(
                captionsEnabled,
                forKey: "slideshow.captions.\(slideshow.id)"
            )
            if !captionsEnabled {
                currentSubtitleText = nil
                currentCueIndex = nil
            } else if let currentTime = videoPlayer?.currentTime().seconds {
                updateSubtitle(at: currentTime)
            }

            PresentationHub.shared.session.updateCaptions(
                ownerID: ownerID,
                isEnabled: captionsEnabled,
                subtitleText: currentSubtitleText
            )
        }
    }

    private let subtitleService: SubtitleService
    private var subtitleCues: [SubtitleCue] = []
    private var subtitleTask: Task<Void, Never>?
    private var subtitleGeneration = 0
    private var currentCueIndex: Int?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var timeControlObservation: NSKeyValueObservation?
    private var itemStatusObservation: NSKeyValueObservation?
    private var imagePreparationTask: Task<Void, Never>?
    private var neighborImageTasks: [String: Task<Void, Never>] = [:]
    private var imageCache: [String: UIImage] = [:]
    private var imageGeneration = 0
    private var hasAcquiredIdleTimer = false
    private var hasAcquiredAudioSession = false
    private var isTornDown = false
    private var wasPlayingBeforeInterruption = false

    init(slideshow: Slideshow, storageService: StorageService) {
        self.slideshow = slideshow
        self.storageService = storageService
        self.subtitleService = SubtitleService(storageService: storageService)
        let defaults = UserDefaults.standard
        let savedIndex = defaults.integer(
            forKey: "slideshow.lastSlide.\(slideshow.id)"
        )
        self.slideIndex = min(max(0, savedIndex), max(0, slideshow.slides.count - 1))
        let captionsKey = "slideshow.captions.\(slideshow.id)"
        self.captionsEnabled = defaults.object(forKey: captionsKey) == nil
            ? true
            : defaults.bool(forKey: captionsKey)
    }

    deinit {
        let presentationOwnerID = ownerID
        Task { @MainActor in
            PresentationHub.shared.session.endPresentation(ownerID: presentationOwnerID)
        }
    }

    var activeSlide: Slide? {
        guard slideshow.slides.indices.contains(slideIndex) else { return nil }
        return slideshow.slides[slideIndex]
    }

    func appear() {
        isTornDown = false
        attachAudioRouteObservers()
        ensureIdleTimer()
        ensureAudioSession()
        loadActiveSlide()
    }

    func selectSlide(_ index: Int) {
        guard slideshow.slides.indices.contains(index), slideIndex != index else { return }
        slideIndex = index
        loadActiveSlide()
    }

    func previousSlide() {
        guard slideIndex > 0 else { return }
        slideIndex -= 1
        loadActiveSlide()
    }

    func nextSlide() {
        guard slideIndex < slideshow.slides.count - 1 else { return }
        slideIndex += 1
        loadActiveSlide()
    }

    func tearDown() {
        guard !isTornDown else { return }
        isTornDown = true

        imagePreparationTask?.cancel()
        imagePreparationTask = nil
        subtitleTask?.cancel()
        subtitleTask = nil
        neighborImageTasks.values.forEach { $0.cancel() }
        neighborImageTasks.removeAll()
        videoPlayer?.pause()
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
        videoPlayer?.replaceCurrentItem(with: nil)
        videoPlayer = nil
        currentImage = nil
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

    private func loadActiveSlide() {
        imageGeneration += 1
        subtitleGeneration += 1
        subtitleTask?.cancel()
        subtitleTask = nil
        imagePreparationTask?.cancel()
        neighborImageTasks.values.forEach { $0.cancel() }
        neighborImageTasks.removeAll()
        removeVideoPlayback()
        currentSubtitleText = nil
        currentCueIndex = nil
        subtitleCues = []

        guard let activeSlide else {
            currentImage = nil
            setPlaybackStatus(.failed("No slide was found."))
            PresentationHub.shared.session.failExternalPresentation(ownerID: ownerID, reason: "No slide was found.")
            return
        }

        switch activeSlide.type {
        case .image:
            loadImageSlide(activeSlide, generation: imageGeneration)
        case .video:
            loadVideoSlide(activeSlide)
        }
    }

    private func loadImageSlide(_ slide: Slide, generation: Int) {
        setPlaybackStatus(.loading)

        guard
            storageService.fileExists(slide.filename),
            let url = try? storageService.localURL(for: slide.filename)
        else {
            currentImage = nil
            beginImagePresentation(image: nil, missingMessage: "This slide is not available in local storage yet.")
            setPlaybackStatus(.failed("This slide is not available in local storage yet."))
            return
        }

        if let cachedImage = imageCache[slide.filename] {
            currentImage = cachedImage
            beginImagePresentation(image: cachedImage, missingMessage: nil)
            setPlaybackStatus(.paused)
            prepareNeighborImages()
            return
        }

        currentImage = nil
        beginImagePresentation(image: nil, missingMessage: nil)

        let maxPixelSize = Self.externalDisplayMaxPixelSize()
        imagePreparationTask = Task.detached(priority: .userInitiated) { [url] in
            let preparedImage = Self.preparedImage(from: url, maxPixelSize: maxPixelSize)
            await MainActor.run {
                guard !Task.isCancelled, generation == self.imageGeneration else { return }

                if let preparedImage {
                    self.imageCache[slide.filename] = preparedImage
                    self.pruneImageCache()
                    self.currentImage = preparedImage
                    self.beginImagePresentation(image: preparedImage, missingMessage: nil)
                    self.setPlaybackStatus(.paused)
                    self.prepareNeighborImages()
                } else {
                    self.currentImage = nil
                    self.beginImagePresentation(image: nil, missingMessage: "This slide image could not be decoded.")
                    self.setPlaybackStatus(.failed("This slide image could not be decoded."))
                }
            }
        }
    }

    private func loadVideoSlide(_ slide: Slide) {
        setPlaybackStatus(.loading)

        guard
            storageService.fileExists(slide.filename),
            let url = try? storageService.localURL(for: slide.filename)
        else {
            beginVideoPresentation(player: nil, missingMessage: "This video slide is not available in local storage yet.")
            setPlaybackStatus(.failed("This video slide is not available in local storage yet."))
            return
        }

        let playerItem = AVPlayerItem(url: url)
        playerItem.preferredForwardBufferDuration = 5

        let nextPlayer = videoPlayer ?? AVPlayer()
        nextPlayer.automaticallyWaitsToMinimizeStalling = false
        nextPlayer.replaceCurrentItem(with: playerItem)
        videoPlayer = nextPlayer

        let generation = subtitleGeneration
        let subtitleService = subtitleService
        let subtitleFilename = slide.filename
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
            self.updateSubtitle(at: self.videoPlayer?.currentTime().seconds ?? 0)
        }
        attachEndObserver(to: playerItem)
        attachItemStatusObserver(to: playerItem)
        attachTimeControlObserver(to: nextPlayer)
        attachSubtitleObserver(to: nextPlayer)
        beginVideoPresentation(player: nextPlayer, missingMessage: nil)
        ensureAudioSession()
        nextPlayer.play()
    }

    private func beginImagePresentation(image: UIImage?, missingMessage: String?) {
        guard let activeSlide else { return }
        PresentationHub.shared.session.beginSlideshow(
            ownerID: ownerID,
            slideshowTitle: slideshow.title,
            slideTitle: activeSlide.title,
            slideNumber: slideIndex + 1,
            slideCount: slideshow.slides.count,
            mediaKind: .slideshowImage,
            image: image,
            player: nil,
            missingMessage: missingMessage,
            captionsEnabled: false,
            subtitleText: nil,
            playbackStatus: playbackStatus
        )
    }

    private func beginVideoPresentation(player: AVPlayer?, missingMessage: String?) {
        guard let activeSlide else { return }
        PresentationHub.shared.session.beginSlideshow(
            ownerID: ownerID,
            slideshowTitle: slideshow.title,
            slideTitle: activeSlide.title,
            slideNumber: slideIndex + 1,
            slideCount: slideshow.slides.count,
            mediaKind: .slideshowVideo,
            image: nil,
            player: player,
            missingMessage: missingMessage,
            captionsEnabled: captionsEnabled,
            subtitleText: currentSubtitleText,
            playbackStatus: playbackStatus
        )
    }

    private func setPlaybackStatus(_ status: PlaybackStatus) {
        guard playbackStatus != status else { return }
        playbackStatus = status
        PresentationHub.shared.session.updatePlaybackStatus(ownerID: ownerID, status: status)
    }

    private func ensureIdleTimer() {
        guard !hasAcquiredIdleTimer else { return }
        PresentationHub.shared.acquireIdleTimerDisable()
        hasAcquiredIdleTimer = true
    }

    private func ensureAudioSession() {
        guard !hasAcquiredAudioSession else { return }
        PresentationHub.shared.acquireAudioSession()
        hasAcquiredAudioSession = true
    }

    private func removeVideoPlayback() {
        removeTimeObserver()
        removeEndObserver()
        timeControlObservation?.invalidate()
        itemStatusObservation?.invalidate()
        timeControlObservation = nil
        itemStatusObservation = nil
        videoPlayer?.pause()
        videoPlayer?.replaceCurrentItem(with: nil)
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
                let message = item.error?.localizedDescription ?? "This video slide could not be played."
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
                self?.currentSubtitleText = nil
                self?.setPlaybackStatus(.ended)
                if let ownerID = self?.ownerID {
                    PresentationHub.shared.session.updateSubtitle(ownerID: ownerID, text: nil)
                }
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
        ) { [weak self] notification in
            guard
                let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                AVAudioSession.RouteChangeReason(rawValue: reasonValue) == .oldDeviceUnavailable
            else { return }
            Task { @MainActor [weak self] in
                self?.videoPlayer?.pause()
                self?.setPlaybackStatus(.paused)
            }
        }

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
                        self.videoPlayer?.timeControlStatus == .playing
                    self.videoPlayer?.pause()
                    self.setPlaybackStatus(.paused)
                case .ended:
                    let optionsValue =
                        notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
                    let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                    if self.wasPlayingBeforeInterruption, options.contains(.shouldResume) {
                        self.ensureAudioSession()
                        self.videoPlayer?.play()
                    }
                    self.wasPlayingBeforeInterruption = false
                @unknown default:
                    break
                }
            }
        }
    }

    func toggleVideoPlayback() {
        guard activeSlide?.type == .video, let videoPlayer else { return }
        if playbackStatus == .playing || playbackStatus == .stalled {
            videoPlayer.pause()
        } else if playbackStatus == .ended {
            replayVideo()
        } else {
            ensureAudioSession()
            videoPlayer.play()
        }
    }

    func replayVideo() {
        guard activeSlide?.type == .video, let videoPlayer else { return }
        ensureAudioSession()
        videoPlayer.seek(to: .zero) { [weak videoPlayer] finished in
            guard finished else { return }
            Task { @MainActor [weak videoPlayer] in
                videoPlayer?.play()
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
            videoPlayer?.removeTimeObserver(timeObserver)
            self.timeObserver = nil
        }
    }

    private func removeEndObserver() {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
    }

    private func prepareNeighborImages() {
        pruneImageCache()

        let neighborIndices = [slideIndex - 1, slideIndex + 1]
        let maxPixelSize = Self.externalDisplayMaxPixelSize()

        for index in neighborIndices where slideshow.slides.indices.contains(index) {
            let slide = slideshow.slides[index]
            guard slide.type == .image,
                  imageCache[slide.filename] == nil,
                  storageService.fileExists(slide.filename),
                  let url = try? storageService.localURL(for: slide.filename)
            else {
                continue
            }

            let task = Task.detached(priority: .utility) { [url, filename = slide.filename] in
                guard let preparedImage = Self.preparedImage(from: url, maxPixelSize: maxPixelSize) else {
                    return
                }

                await MainActor.run {
                    guard self.neighborImageTasks[filename] != nil else { return }
                    self.imageCache[filename] = preparedImage
                    self.neighborImageTasks[filename] = nil
                    self.pruneImageCache()
                }
            }
            neighborImageTasks[slide.filename] = task
        }
    }

    private func pruneImageCache() {
        let allowedFilenames = Set(
            [slideIndex - 1, slideIndex, slideIndex + 1]
                .filter { slideshow.slides.indices.contains($0) }
                .map { slideshow.slides[$0].filename }
        )

        imageCache = imageCache.filter { allowedFilenames.contains($0.key) }
    }

    private static func externalDisplayMaxPixelSize() -> CGFloat {
        let externalScreen = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.session.role == .windowExternalDisplayNonInteractive }?
            .screen

        if let externalScreen {
            return max(1_920, max(externalScreen.nativeBounds.width, externalScreen.nativeBounds.height))
        }

        return 1_920
    }

    nonisolated private static func preparedImage(from url: URL, maxPixelSize: CGFloat) -> UIImage? {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else {
            return nil
        }

        let thumbnailOptions = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
        ] as CFDictionary

        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}
