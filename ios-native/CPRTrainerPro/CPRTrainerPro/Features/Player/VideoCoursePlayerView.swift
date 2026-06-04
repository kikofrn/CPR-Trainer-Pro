import AVKit
import SwiftUI

@MainActor
struct VideoCoursePlayerView: View {
    let videoCourse: VideoCourse
    let storageService: StorageService

    @Environment(\.dismiss) private var dismiss
    @StateObject private var coordinator: VideoCoursePlaybackCoordinator
    @ObservedObject private var presentationSession = PresentationHub.shared.session
    @State private var isFullScreen = false
    @State private var overlayControlsVisible = true
    @State private var overlayControlsHideToken = UUID()

    init(videoCourse: VideoCourse, storageService: StorageService) {
        self.videoCourse = videoCourse
        self.storageService = storageService
        _coordinator = StateObject(
            wrappedValue: VideoCoursePlaybackCoordinator(
                videoCourse: videoCourse,
                storageService: storageService
            )
        )
    }

    private var selectedChapter: Chapter? {
        coordinator.selectedChapter
    }

    private var isPresentingExternally: Bool {
        presentationSession.state.externalSceneActive &&
            presentationSession.state.activeOwnerID == coordinator.ownerID
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
                        ContinuousPlayToggleButton(isEnabled: $coordinator.continuousPlayEnabled)

                        CaptionToggleButton(captionsEnabled: $coordinator.captionsEnabled)

                        AirPlayRoutePicker()
                            .frame(width: 34, height: 34)

                        FullScreenToggleButton(isFullScreen: $isFullScreen)
                    }
                }
            }
            .onAppear {
                coordinator.appear()
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

            if let player = coordinator.player {
                if isPresentingExternally {
                    externalPlaybackStatusSurface
                } else {
                    ConfigurableVideoPlayer(player: player)

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
                mediaUnavailableView
            }
        }
    }

    private var mediaUnavailableView: some View {
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

    private var externalPlaybackStatusSurface: some View {
        VStack(spacing: 14) {
            Image(systemName: "tv.and.mediabox")
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(Theme.Colors.peach)

            Text("Playing on External Display")
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)

            Text(selectedChapter?.title ?? videoCourse.shortTitle)
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
        }
        .padding(20)
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
                .foregroundStyle(coordinator.continuousPlayEnabled ? Theme.Colors.peach : .white.opacity(0.56))
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

            Toggle("", isOn: $coordinator.continuousPlayEnabled)
                .labelsHidden()
                .tint(Theme.Colors.peach)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(Theme.Colors.surface)
    }

    private var chaptersList: some View {
        List(coordinator.playableChapters) { chapter in
            Button {
                coordinator.select(chapter)
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
                chapterControlButton(
                    systemImage: "backward.end.fill",
                    label: "Previous chapter",
                    isDisabled: !coordinator.hasPreviousChapter
                ) {
                    coordinator.previousChapter()
                }

                VStack(spacing: 3) {
                    Text(selectedChapter?.title ?? "Video Chapter")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)

                    Text(coordinator.continuousPlayEnabled ? "Continuous Play On" : "Continuous Play Off")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Theme.Colors.peach)
                }
                .frame(maxWidth: .infinity)

                ContinuousPlayToggleButton(isEnabled: $coordinator.continuousPlayEnabled)

                chapterControlButton(
                    systemImage: "forward.end.fill",
                    label: "Next chapter",
                    isDisabled: !coordinator.hasNextChapter
                ) {
                    coordinator.nextChapter()
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
                    ContinuousPlayToggleButton(isEnabled: $coordinator.continuousPlayEnabled)

                    CaptionToggleButton(captionsEnabled: $coordinator.captionsEnabled)

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

private struct ConfigurableVideoPlayer: UIViewControllerRepresentable {
    let player: AVPlayer

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let controller = AVPlayerViewController()
        controller.player = player
        controller.showsPlaybackControls = true
        controller.videoGravity = .resizeAspect
        controller.speeds = Self.playbackSpeeds
        return controller
    }

    func updateUIViewController(_ controller: AVPlayerViewController, context: Context) {
        if controller.player !== player {
            controller.player = player
        }

        controller.speeds = Self.playbackSpeeds
    }

    private static let playbackSpeeds: [AVPlaybackSpeed] = {
        let customSpeed = AVPlaybackSpeed(rate: 1.15, localizedName: "1.15x")
        var speeds = AVPlaybackSpeed.systemDefaultSpeeds

        guard !speeds.contains(where: { abs($0.rate - customSpeed.rate) < 0.001 }) else {
            return speeds
        }

        speeds.append(customSpeed)
        return speeds.sorted { $0.rate < $1.rate }
    }()
}
