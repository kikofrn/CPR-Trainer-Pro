import AVFoundation
import SwiftUI
import UIKit

struct ExternalPresentationView: View {
    @EnvironmentObject private var session: PresentationSession
    @State private var standbyDimmed = false

    var body: some View {
        GeometryReader { proxy in
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
            .padding(.horizontal, proxy.size.width * 0.035)
            .padding(.vertical, proxy.size.height * 0.035)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.black)
        .onAppear(perform: scheduleStandbyDimming)
    }

    private var standbyView: some View {
        VStack(spacing: 18) {
            if let logo = artwork(named: "EHAcademyTrainerProLogo.png") {
                Image(uiImage: logo)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 520)
                    .opacity(standbyDimmed ? 0.50 : 1)
            }

            Text("Ready for Course Display")
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white.opacity(standbyDimmed ? 0.35 : 0.62))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func videoPresentation(_ videoState: VideoCourseExternalState) -> some View {
        if let player = videoState.player {
            ZStack {
                CoursePlayerLayerView(player: player)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                if session.state.captionsEnabled {
                    externalSubtitleOverlay
                }
            }
        } else {
            externalErrorView(videoState.missingMessage ?? "Video is not available on this device.")
        }
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
            } else {
                externalStatusView(
                    title: slideshowState.slideTitle,
                    message: slideshowState.missingMessage ?? "Preparing slide..."
                )
            }
        case .slideshowVideo:
            if let player = slideshowState.player {
                ZStack {
                    CoursePlayerLayerView(player: player)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                    if session.state.captionsEnabled {
                        externalSubtitleOverlay
                    }
                }
            } else {
                externalErrorView(slideshowState.missingMessage ?? "Video slide is not available on this device.")
            }
        case .videoCourse:
            EmptyView()
        }
    }

    private var externalSubtitleOverlay: some View {
        VStack {
            Spacer()

            SubtitleOverlay(text: session.state.currentSubtitleText)
                .font(.title2.weight(.bold))
                .padding(.horizontal, 36)
                .padding(.bottom, 34)
        }
        .allowsHitTesting(false)
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

    private func scheduleStandbyDimming() {
        standbyDimmed = false
        Task {
            try? await Task.sleep(nanoseconds: 300_000_000_000)
            await MainActor.run {
                withAnimation(.easeInOut(duration: 1.0)) {
                    standbyDimmed = true
                }
            }
        }
    }

    private func artwork(named name: String) -> UIImage? {
        guard let url = Bundle.main.url(forResource: name, withExtension: nil, subdirectory: "Artwork") else {
            return nil
        }

        return UIImage(contentsOfFile: url.path)
    }
}
