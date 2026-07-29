import AVFoundation
import SwiftUI
import UIKit

struct ExternalPresentationView: View {
    @EnvironmentObject private var session: PresentationSession

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let sceneError = session.state.externalSceneErrorMessage {
                externalErrorView(sceneError)
            } else {
                switch session.state.presentation {
                case .video(let videoState):
                    videoPresentation(videoState)
                case .slideshow(let slideshowState):
                    slideshowPresentation(slideshowState)
                case .error(let message):
                    externalErrorView(message)
                case nil:
                    standbyView
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
        .ignoresSafeArea()
    }

    private var standbyView: some View {
        Group {
            if let idleScreen = artwork(named: "eha-idle-screen.png") {
                Image(uiImage: idleScreen)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Text("Ready for Course Display")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.62))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func videoPresentation(_ videoState: VideoCourseExternalState) -> some View {
        if let failureReason = session.state.playbackStatus.failureReason {
            externalErrorView(failureReason)
        } else if videoState.isExternalPlaybackActive {
            nativeAirPlayStatusView(videoState)
        } else if let player = videoState.player {
            GeometryReader { proxy in
                CoursePlayerLayerView(
                    player: player,
                    revision: session.state.presentationRevision
                )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .ignoresSafeArea()

                if session.state.captionsEnabled {
                    externalSubtitleOverlay(displaySize: proxy.size)
                }
            }
        } else {
            externalErrorView(videoState.missingMessage ?? "Video is not available on this device.")
        }
    }

    private func nativeAirPlayStatusView(_ videoState: VideoCourseExternalState) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "airplayvideo")
                .font(.system(size: 54, weight: .semibold))
                .foregroundStyle(Theme.Colors.peach)

            Text("Playing Directly on Your TV")
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)

            Text(videoState.chapterTitle)
                .font(.body.weight(.medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.68))
                .lineLimit(2)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func slideshowPresentation(_ slideshowState: SlideshowExternalState) -> some View {
        switch slideshowState.mediaKind {
        case .slideshowImage:
            if let image = slideshowState.image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .ignoresSafeArea()
            } else {
                externalStatusView(
                    title: slideshowState.slideTitle,
                    message: slideshowState.missingMessage ?? "Preparing slide..."
                )
            }
        case .slideshowVideo:
            if let failureReason = session.state.playbackStatus.failureReason {
                externalErrorView(failureReason)
            } else if let player = slideshowState.player {
                GeometryReader { proxy in
                    CoursePlayerLayerView(
                        player: player,
                        revision: session.state.presentationRevision
                    )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .ignoresSafeArea()

                    if session.state.captionsEnabled {
                        externalSubtitleOverlay(displaySize: proxy.size)
                    }
                }
            } else {
                externalErrorView(slideshowState.missingMessage ?? "Video slide is not available on this device.")
            }
        case .videoCourse:
            EmptyView()
        }
    }

    private func externalSubtitleOverlay(displaySize: CGSize) -> some View {
        let subtitleFontSize = min(max(displaySize.width * 0.028, 34), 58)
        let horizontalPadding = max(displaySize.width * 0.08, 90)
        let bottomPadding = max(displaySize.height * 0.055, 52)
        let maxCaptionWidth = max(280, displaySize.width - horizontalPadding)

        return VStack {
            Spacer()

            if let text = session.state.currentSubtitleText, !text.isEmpty {
                Text(text)
                    .font(.system(size: subtitleFontSize, weight: .bold, design: .default))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 16)
                    .frame(maxWidth: maxCaptionWidth)
                    .background(.black.opacity(0.74), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .shadow(color: .black.opacity(0.45), radius: 14, y: 5)
                    .transition(.opacity)
                    .padding(.bottom, bottomPadding)
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }

    private func externalStatusView(title: String, message: String) -> some View {
        VStack(spacing: 14) {
            ProgressView()
                .tint(Theme.Colors.peach)
                .scaleEffect(1.4)

            Text(title)
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)

            Text(message)
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.66))
        }
        .padding(28)
        .frame(maxWidth: 520)
    }

    private func externalErrorView(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 46, weight: .semibold))
                .foregroundStyle(Theme.Colors.warning)

            Text("External Display")
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)

            Text(message)
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.68))
        }
        .padding(30)
        .frame(maxWidth: 560)
    }

    private func artwork(named name: String) -> UIImage? {
        guard let url = Bundle.main.url(forResource: name, withExtension: nil, subdirectory: "Artwork") else {
            return nil
        }

        return UIImage(contentsOfFile: url.path)
    }
}
