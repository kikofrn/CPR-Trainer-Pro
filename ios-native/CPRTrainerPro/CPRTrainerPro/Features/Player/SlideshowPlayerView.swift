import AVKit
import SwiftUI
import UIKit

@MainActor
struct SlideshowPlayerView: View {
    let slideshow: Slideshow
    let storageService: StorageService

    @Environment(\.dismiss) private var dismiss
    @StateObject private var coordinator: SlideshowPlaybackCoordinator
    @ObservedObject private var presentationSession = PresentationHub.shared.session
    @State private var isFullScreen = false
    @State private var overlayControlsVisible = true
    @State private var overlayControlsHideToken = UUID()
    @State private var instructorTipsVisible = false
    @State private var slidePickerVisible = false

    private let instructorTipsService = InstructorTipsService.shared

    init(slideshow: Slideshow, storageService: StorageService) {
        self.slideshow = slideshow
        self.storageService = storageService
        _coordinator = StateObject(
            wrappedValue: SlideshowPlaybackCoordinator(
                slideshow: slideshow,
                storageService: storageService
            )
        )
    }

    private var activeSlide: Slide? {
        coordinator.activeSlide
    }

    private var activeInstructorTip: InstructorSlideTip? {
        guard let activeSlide else { return nil }
        return instructorTipsService.tip(for: slideshow.id, slideID: activeSlide.id)
    }

    private var isPresentingExternally: Bool {
        presentationSession.state.externalSceneConnected &&
            presentationSession.state.activeOwnerID == coordinator.ownerID
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

                    instructorDeviceOverlay(bottomInset: proxy.safeAreaInsets.bottom)
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
                            CaptionToggleButton(captionsEnabled: $coordinator.captionsEnabled)
                        }

                        AirPlayRoutePicker()
                            .frame(width: 34, height: 34)

                        FullScreenToggleButton(isFullScreen: $isFullScreen)
                    }
                }
            }
            .onAppear {
                coordinator.appear()
            }
            .onChange(of: coordinator.slideIndex) { _, _ in
                if activeInstructorTip == nil {
                    instructorTipsVisible = false
                }
            }
            .onChange(of: isFullScreen) { _, isFullScreen in
                overlayControlsVisible = true
                if isFullScreen {
                    scheduleFullScreenControlsHide()
                }
            }
            .onDisappear {
                coordinator.tearDown()
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
                    if let image = coordinator.currentImage {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                    } else if storageService.fileExists(activeSlide.filename) {
                        preparingSlideView(activeSlide)
                    } else {
                        missingSlideView(activeSlide)
                    }
                case .video:
                    if let videoPlayer = coordinator.videoPlayer {
                        if isPresentingExternally {
                            externalPlaybackStatusSurface
                        } else {
                            VideoPlayer(player: videoPlayer)

                            if coordinator.captionsEnabled {
                                VStack {
                                    Spacer()
                                    SubtitleOverlay(text: coordinator.currentSubtitleText)
                                        .padding(.horizontal, 18)
                                        .padding(.bottom, 12)
                                }
                                .allowsHitTesting(false)
                            }
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
        .modifier(
            SlideSwipeGestureModifier(
                isEnabled: activeSlide?.type == .image,
                onEnded: handleSwipe
            )
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
                ZStack {
                    Button(action: showSlidePicker) {
                        HStack(spacing: 8) {
                            Text(activeSlide.title)
                                .font(.headline)
                                .foregroundStyle(.white)
                                .lineLimit(2)
                                .multilineTextAlignment(.center)

                            Image(systemName: "chevron.up")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.Colors.peach)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Choose a slide")
                    .padding(.horizontal, activeInstructorTip == nil ? 0 : 92)

                    if activeInstructorTip != nil {
                        HStack {
                            Spacer(minLength: 0)

                            InstructorTipsToggleButton(
                                isPresented: instructorTipsVisible,
                                action: toggleInstructorTips
                            )
                            .fixedSize()
                        }
                    }
                }
            }

            HStack(spacing: 18) {
                Button {
                    coordinator.previousSlide()
                } label: {
                    Image(systemName: "chevron.left.circle.fill")
                        .font(.system(size: 36))
                        .frame(width: 56, height: 56)
                }
                .disabled(coordinator.slideIndex == 0)

                Text("\(coordinator.slideIndex + 1) / \(slideshow.slides.count)")
                    .font(.subheadline.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.white.opacity(0.74))
                    .frame(minWidth: 88)

                Button {
                    coordinator.nextSlide()
                } label: {
                    Image(systemName: "chevron.right.circle.fill")
                        .font(.system(size: 36))
                        .frame(width: 56, height: 56)
                }
                .disabled(coordinator.slideIndex >= slideshow.slides.count - 1)
            }
            .foregroundStyle(Theme.Colors.peach)
            .frame(maxWidth: .infinity)
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

                Button(action: showSlidePicker) {
                    Text(slideshow.title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Choose a slide")

                Spacer(minLength: 12)

                HStack(spacing: 8) {
                    if activeSlide?.type == .video {
                        CaptionToggleButton(captionsEnabled: $coordinator.captionsEnabled)
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

    @ViewBuilder
    private func instructorDeviceOverlay(bottomInset: CGFloat) -> some View {
        if shouldShowInstructorOverlay {
            VStack(spacing: 12) {
                Spacer(minLength: 0)

                if slidePickerVisible {
                    SlidePickerPanel(
                        slideshow: slideshow,
                        selectedIndex: coordinator.slideIndex,
                        selectSlide: selectSlide,
                        close: hideSlidePicker
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                } else if instructorTipsVisible, let activeInstructorTip {
                    InstructorTipsPanel(
                        tip: activeInstructorTip,
                        close: hideInstructorTips
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                if isFullScreen && activeInstructorTip != nil && !slidePickerVisible {
                    HStack {
                        Spacer()

                        InstructorTipsToggleButton(
                            isPresented: instructorTipsVisible,
                            action: toggleInstructorTips
                        )
                    }
                    .padding(.trailing, 20)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, isFullScreen ? bottomInset + 14 : bottomInset + 128)
            .animation(.spring(response: 0.28, dampingFraction: 0.86), value: instructorTipsVisible)
            .animation(.spring(response: 0.28, dampingFraction: 0.86), value: slidePickerVisible)
            .zIndex(3)
        }
    }

    private func preparingSlideView(_ slide: Slide) -> some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Theme.Colors.peach)
                .scaleEffect(1.2)

            Text("Preparing Slide")
                .font(.headline)
                .foregroundStyle(.white)

            Text(slide.title)
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.58))
                .padding(.horizontal)
        }
    }

    private func missingSlideView(_ slide: Slide) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.largeTitle)
                .foregroundStyle(Theme.Colors.warning)

            Text("Slide Not Available")
                .font(.headline)
                .foregroundStyle(.white)

            Text(coordinator.playbackStatus.failureReason ?? slide.filename)
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.58))
                .padding(.horizontal)
        }
    }

    private var externalPlaybackStatusSurface: some View {
        VStack(spacing: 14) {
            Image(systemName: "tv.and.mediabox")
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(Theme.Colors.peach)

            Text("Playing on External Display")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)

            Text(activeSlide?.title ?? slideshow.title)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.66))
                .lineLimit(2)

            Text(coordinator.playbackStatus.displayText)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.peach)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(.white.opacity(0.08), in: Capsule())

            HStack(spacing: 18) {
                Button {
                    coordinator.toggleVideoPlayback()
                } label: {
                    Image(
                        systemName: coordinator.playbackStatus == .playing
                            ? "pause.circle.fill"
                            : "play.circle.fill"
                    )
                    .font(.system(size: 38))
                    .frame(width: 56, height: 56)
                }
                .accessibilityLabel(
                    coordinator.playbackStatus == .playing ? "Pause video" : "Play video"
                )

                Button {
                    coordinator.replayVideo()
                } label: {
                    Image(systemName: "arrow.counterclockwise.circle.fill")
                        .font(.system(size: 38))
                        .frame(width: 56, height: 56)
                }
                .accessibilityLabel("Replay video")
            }
            .foregroundStyle(Theme.Colors.peach)
        }
        .padding(20)
    }

    private var shouldShowInstructorOverlay: Bool {
        !isFullScreen || overlayControlsVisible || instructorTipsVisible || slidePickerVisible
    }

    private func toggleInstructorTips() {
        guard activeInstructorTip != nil else { return }
        slidePickerVisible = false
        withAnimation {
            instructorTipsVisible.toggle()
        }
        revealFullScreenControls()
    }

    private func hideInstructorTips() {
        withAnimation {
            instructorTipsVisible = false
        }
        revealFullScreenControls()
    }

    private func showSlidePicker() {
        instructorTipsVisible = false
        withAnimation {
            slidePickerVisible = true
        }
        revealFullScreenControls()
    }

    private func hideSlidePicker() {
        withAnimation {
            slidePickerVisible = false
        }
        revealFullScreenControls()
    }

    private func selectSlide(_ index: Int) {
        coordinator.selectSlide(index)
        hideSlidePicker()
    }

    private func handleSwipe(_ value: DragGesture.Value) {
        let horizontalDistance = value.translation.width
        let verticalDistance = value.translation.height

        guard abs(horizontalDistance) > 58, abs(horizontalDistance) > abs(verticalDistance) * 1.25 else {
            return
        }

        if horizontalDistance < 0 {
            coordinator.nextSlide()
        } else {
            coordinator.previousSlide()
        }
    }

    private func closePlayer() {
        coordinator.tearDown()
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
}

private struct SlideSwipeGestureModifier: ViewModifier {
    let isEnabled: Bool
    let onEnded: (DragGesture.Value) -> Void

    @ViewBuilder
    func body(content: Content) -> some View {
        if isEnabled {
            content.simultaneousGesture(
                DragGesture(minimumDistance: 40)
                    .onEnded(onEnded)
            )
        } else {
            content
        }
    }
}
