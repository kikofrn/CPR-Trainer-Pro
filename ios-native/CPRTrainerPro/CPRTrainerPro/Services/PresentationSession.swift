import AVFoundation
import UIKit

enum PlaybackStatus: Equatable {
    case idle
    case loading
    case playing
    case paused
    case stalled
    case ended
    case failed(String)

    var displayText: String {
        switch self {
        case .idle:
            "Ready"
        case .loading:
            "Loading"
        case .playing:
            "Playing"
        case .paused:
            "Paused"
        case .stalled:
            "Buffering"
        case .ended:
            "Ended"
        case .failed:
            "Playback issue"
        }
    }
}

enum ExternalMediaKind {
    case videoCourse
    case slideshowImage
    case slideshowVideo
}

struct VideoCourseExternalState {
    let ownerID: UUID
    let courseTitle: String
    let chapterTitle: String
    let player: AVPlayer?
    let missingMessage: String?
}

struct SlideshowExternalState {
    let ownerID: UUID
    let slideshowTitle: String
    let slideTitle: String
    let slideNumber: Int
    let slideCount: Int
    let mediaKind: ExternalMediaKind
    let image: UIImage?
    let player: AVPlayer?
    let missingMessage: String?
}

enum ExternalPresentation {
    case video(VideoCourseExternalState)
    case slideshow(SlideshowExternalState)
    case error(String)
}

struct PresentationSessionState {
    var externalSceneConnected = false
    var externalSceneActive = false
    var activeOwnerID: UUID?
    var presentation: ExternalPresentation?
    var captionsEnabled = false
    var currentSubtitleText: String?
    var playbackStatus: PlaybackStatus = .idle
    var continuousPlayEnabled = false
    var externalSceneErrorMessage: String?
}

@MainActor
final class PresentationSession: ObservableObject {
    @Published private(set) var state = PresentationSessionState()

    func setExternalSceneConnected(_ isConnected: Bool) {
        guard state.externalSceneConnected != isConnected else { return }
        var nextState = state
        nextState.externalSceneConnected = isConnected
        if !isConnected {
            nextState.externalSceneActive = false
            nextState.externalSceneErrorMessage = nil
        }
        state = nextState
    }

    func setExternalSceneActive(_ isActive: Bool) {
        guard state.externalSceneActive != isActive else { return }
        var nextState = state
        nextState.externalSceneActive = isActive
        state = nextState
    }

    func setExternalSceneError(_ message: String?) {
        guard state.externalSceneErrorMessage != message else { return }
        var nextState = state
        nextState.externalSceneErrorMessage = message
        state = nextState
    }

    func beginVideo(
        ownerID: UUID,
        courseTitle: String,
        chapterTitle: String,
        player: AVPlayer?,
        missingMessage: String?,
        captionsEnabled: Bool,
        subtitleText: String?,
        playbackStatus: PlaybackStatus,
        continuousPlayEnabled: Bool
    ) {
        var nextState = state
        nextState.activeOwnerID = ownerID
        nextState.presentation = .video(
            VideoCourseExternalState(
                ownerID: ownerID,
                courseTitle: courseTitle,
                chapterTitle: chapterTitle,
                player: player,
                missingMessage: missingMessage
            )
        )
        nextState.captionsEnabled = captionsEnabled
        nextState.currentSubtitleText = subtitleText
        nextState.playbackStatus = playbackStatus
        nextState.continuousPlayEnabled = continuousPlayEnabled
        nextState.externalSceneErrorMessage = nil
        state = nextState
    }

    func beginSlideshow(
        ownerID: UUID,
        slideshowTitle: String,
        slideTitle: String,
        slideNumber: Int,
        slideCount: Int,
        mediaKind: ExternalMediaKind,
        image: UIImage?,
        player: AVPlayer?,
        missingMessage: String?,
        captionsEnabled: Bool,
        subtitleText: String?,
        playbackStatus: PlaybackStatus
    ) {
        var nextState = state
        nextState.activeOwnerID = ownerID
        nextState.presentation = .slideshow(
            SlideshowExternalState(
                ownerID: ownerID,
                slideshowTitle: slideshowTitle,
                slideTitle: slideTitle,
                slideNumber: slideNumber,
                slideCount: slideCount,
                mediaKind: mediaKind,
                image: image,
                player: player,
                missingMessage: missingMessage
            )
        )
        nextState.captionsEnabled = captionsEnabled
        nextState.currentSubtitleText = subtitleText
        nextState.playbackStatus = playbackStatus
        nextState.continuousPlayEnabled = false
        nextState.externalSceneErrorMessage = nil
        state = nextState
    }

    func updateVideoPresentation(
        ownerID: UUID,
        chapterTitle: String,
        player: AVPlayer?,
        missingMessage: String?
    ) {
        guard state.activeOwnerID == ownerID,
              case .video(let videoState) = state.presentation
        else {
            return
        }

        var nextState = state
        nextState.presentation = .video(
            VideoCourseExternalState(
                ownerID: ownerID,
                courseTitle: videoState.courseTitle,
                chapterTitle: chapterTitle,
                player: player,
                missingMessage: missingMessage
            )
        )
        state = nextState
    }

    func updateSlideshowPresentation(
        ownerID: UUID,
        slideTitle: String,
        slideNumber: Int,
        slideCount: Int,
        mediaKind: ExternalMediaKind,
        image: UIImage?,
        player: AVPlayer?,
        missingMessage: String?
    ) {
        guard state.activeOwnerID == ownerID,
              case .slideshow(let slideshowState) = state.presentation
        else {
            return
        }

        var nextState = state
        nextState.presentation = .slideshow(
            SlideshowExternalState(
                ownerID: ownerID,
                slideshowTitle: slideshowState.slideshowTitle,
                slideTitle: slideTitle,
                slideNumber: slideNumber,
                slideCount: slideCount,
                mediaKind: mediaKind,
                image: image,
                player: player,
                missingMessage: missingMessage
            )
        )
        state = nextState
    }

    func updateCaptions(ownerID: UUID, isEnabled: Bool, subtitleText: String?) {
        guard state.activeOwnerID == ownerID else { return }
        guard state.captionsEnabled != isEnabled || state.currentSubtitleText != subtitleText else { return }

        var nextState = state
        nextState.captionsEnabled = isEnabled
        nextState.currentSubtitleText = subtitleText
        state = nextState
    }

    func updateSubtitle(ownerID: UUID, text: String?) {
        guard state.activeOwnerID == ownerID else { return }
        guard state.currentSubtitleText != text else { return }

        var nextState = state
        nextState.currentSubtitleText = text
        state = nextState
    }

    func updatePlaybackStatus(ownerID: UUID, status: PlaybackStatus) {
        guard state.activeOwnerID == ownerID else { return }
        guard state.playbackStatus != status else { return }

        var nextState = state
        nextState.playbackStatus = status
        state = nextState
    }

    func updateContinuousPlay(ownerID: UUID, isEnabled: Bool) {
        guard state.activeOwnerID == ownerID else { return }
        guard state.continuousPlayEnabled != isEnabled else { return }

        var nextState = state
        nextState.continuousPlayEnabled = isEnabled
        state = nextState
    }

    func failExternalPresentation(ownerID: UUID, reason: String) {
        guard state.activeOwnerID == ownerID else { return }

        var nextState = state
        nextState.presentation = .error(reason)
        nextState.playbackStatus = .failed(reason)
        nextState.currentSubtitleText = nil
        state = nextState
    }

    func endPresentation(ownerID: UUID) {
        guard state.activeOwnerID == ownerID else { return }

        var nextState = state
        nextState.activeOwnerID = nil
        nextState.presentation = nil
        nextState.captionsEnabled = false
        nextState.currentSubtitleText = nil
        nextState.playbackStatus = .idle
        nextState.continuousPlayEnabled = false
        nextState.externalSceneErrorMessage = nil
        state = nextState
    }
}

@MainActor
final class PresentationHub {
    static let shared = PresentationHub()

    let session = PresentationSession()

    private var idleTimerReferenceCount = 0
    private var audioSessionReferenceCount = 0
    private var audioSessionConfigured = false

    private init() {}

    func acquireIdleTimerDisable() {
        idleTimerReferenceCount += 1
        UIApplication.shared.isIdleTimerDisabled = true
    }

    func releaseIdleTimerDisable() {
        idleTimerReferenceCount = max(0, idleTimerReferenceCount - 1)
        if idleTimerReferenceCount == 0 {
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }

    func configureAudioSessionIfNeeded() {
        guard !audioSessionConfigured else { return }

        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .moviePlayback,
                options: [.allowAirPlay]
            )
            audioSessionConfigured = true
        } catch {
            session.setExternalSceneError("Audio session setup failed: \(error.localizedDescription)")
        }
    }

    func acquireAudioSession() {
        configureAudioSessionIfNeeded()
        audioSessionReferenceCount += 1

        do {
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            session.setExternalSceneError("Audio route setup failed: \(error.localizedDescription)")
        }
    }

    func releaseAudioSession() {
        audioSessionReferenceCount = max(0, audioSessionReferenceCount - 1)
        guard audioSessionReferenceCount == 0 else { return }

        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            session.setExternalSceneError("Audio route cleanup failed: \(error.localizedDescription)")
        }
    }
}
