import SwiftUI

struct RootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var appViewModel: AppViewModel
    @EnvironmentObject private var downloadService: DownloadService
    @State private var showsLaunchExperience = true
    @State private var launchExperienceMode = LaunchExperienceMode.startup
    @State private var launchExperienceToken: ForegroundExperienceToken?

    var body: some View {
        ZStack {
            tabContent
                .environment(\.launchExperienceTrigger) {
                    launchExperienceMode = .practice
                    launchExperienceToken = appViewModel.acquireForegroundExperience(
                        "practice-animation"
                    )
                    withAnimation(.easeInOut(duration: 0.22)) {
                        showsLaunchExperience = true
                    }
                }

            if showsLaunchExperience {
                LaunchExperienceView(mode: launchExperienceMode) {
                    let completedMode = launchExperienceMode
                    withAnimation(.easeInOut(duration: 0.22)) {
                        showsLaunchExperience = false
                    }
                    if completedMode == .startup {
                        appViewModel.presentInitialDownloadPromptIfNeeded()
                    } else {
                        appViewModel.releaseForegroundExperience(launchExperienceToken)
                        launchExperienceToken = nil
                    }
                }
                .transition(.opacity)
                .zIndex(10)
            }
        }
        .background(Theme.Colors.background)
        .preferredColorScheme(.dark)
        .sheet(item: activePromptBinding) { prompt in
            Group {
                switch prompt {
                case .initialDownload(let estimate):
                    InitialDownloadPromptView(
                        estimate: estimate,
                        onDownloadAll: appViewModel.downloadAllContent,
                        onNotYet: appViewModel.dismissInitialDownloadPrompt
                    )
                case .contentUpdate(let summary):
                    ContentUpdatePromptView(
                        summary: summary,
                        onUpdate: {
                            appViewModel.beginContentUpdate(summary)
                        },
                        onNotYet: appViewModel.dismissContentUpdatePrompt
                    )
                }
            }
            .presentationDragIndicator(.hidden)
            .presentationDetents([.fraction(0.72), .large])
            .presentationBackground(Theme.Colors.background)
            .interactiveDismissDisabled()
        }
        .onAppear {
            appViewModel.appDidBecomeActive()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                appViewModel.appDidBecomeActive()
            } else {
                appViewModel.appDidEnterBackground()
            }
        }
        .onChange(of: downloadService.isDownloadingAll) { _, _ in
            appViewModel.downloadAllStateDidChange()
        }
    }

    private var activePromptBinding: Binding<AppPrompt?> {
        Binding(
            get: { appViewModel.activePrompt },
            set: { prompt in
                if prompt == nil {
                    appViewModel.dismissActivePrompt()
                }
            }
        )
    }

    private var tabContent: some View {
        InteractiveTabContainer(
            selection: $appViewModel.selectedTab,
            appViewModel: appViewModel
        )
    }
}

private struct InitialDownloadPromptView: View {
    @EnvironmentObject private var downloadService: DownloadService
    let estimate: DownloadContentEstimate
    let onDownloadAll: () -> Void
    let onNotYet: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 46, weight: .bold))
                    .foregroundStyle(Theme.Colors.peach)
                    .accessibilityHidden(true)

                VStack(spacing: 8) {
                    Text("Download Everything?")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)

                    Text(
                        "Give the app the full superhero treatment: download every course now for smooth, instant playback—even when classroom Wi‑Fi decides to take a coffee break."
                    )
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.76))
                    .fixedSize(horizontal: false, vertical: true)
                }

                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 10) {
                        estimatePill(
                            title: "Still to Download",
                            value: estimate.sizeText,
                            systemImage: "externaldrive.fill"
                        )
                        estimatePill(
                            title: "Estimated Time",
                            value: estimate.durationText,
                            systemImage: "clock.fill"
                        )
                    }

                    VStack(spacing: 10) {
                        estimatePill(
                            title: "Still to Download",
                            value: estimate.sizeText,
                            systemImage: "externaldrive.fill"
                        )
                        estimatePill(
                            title: "Estimated Time",
                            value: estimate.durationText,
                            systemImage: "clock.fill"
                        )
                    }
                }

                Text(
                    "*You can use other apps while it downloads. It will continue in the background, but force-quitting CPR Trainer Pro pauses the process until you reopen it."
                )
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.58))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

                if let message = downloadService.lastPreflightErrorMessage {
                    Text(message)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.failure)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }

                VStack(spacing: 10) {
                    Button("Download All Courses Now", action: onDownloadAll)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Theme.Colors.peach)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                    Button("Not Yet", action: onNotYet)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.82))
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 24)
        }
        .scrollIndicators(.hidden)
    }

    private func estimatePill(
        title: String,
        value: String,
        systemImage: String
    ) -> some View {
        VStack(spacing: 5) {
            Label(title, systemImage: systemImage)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.58))
                .lineLimit(1)

            Text(value)
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .minimumScaleFactor(0.84)
        }
        .frame(maxWidth: .infinity, minHeight: 72)
        .padding(.horizontal, 8)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
}

private struct ContentUpdatePromptView: View {
    let summary: ContentUpdateSummary
    let onUpdate: () -> Void
    let onNotYet: () -> Void
    @State private var detailsExpanded = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: "sparkles")
                    .font(.system(size: 44, weight: .bold))
                    .foregroundStyle(Theme.Colors.peach)
                    .accessibilityHidden(true)

                VStack(spacing: 8) {
                    Text("New course files just dropped.")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)

                    Text(
                        "Update now to make sure you're using the latest materials."
                    )
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.76))
                    .fixedSize(horizontal: false, vertical: true)
                }

                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 10) {
                        summaryPills
                    }
                    VStack(spacing: 10) {
                        summaryPills
                    }
                }

                DisclosureGroup(isExpanded: $detailsExpanded) {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(groupedCandidates, id: \.name) { group in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(group.name)
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.Colors.peach)
                                ForEach(group.files, id: \.self) { filename in
                                    Text(filename)
                                        .font(.caption2)
                                        .foregroundStyle(.white.opacity(0.68))
                                        .lineLimit(2)
                                }
                            }
                        }
                    }
                    .padding(.top, 8)
                } label: {
                    Text("What’s changing")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                }
                .tint(Theme.Colors.peach)
                .padding(14)
                .background(Theme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

                Text(
                    "*The current files stay safely in place until their replacements finish downloading and pass validation."
                )
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.58))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

                VStack(spacing: 10) {
                    Button("Update Now", action: onUpdate)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Theme.Colors.peach)
                        .clipShape(
                            RoundedRectangle(
                                cornerRadius: 14,
                                style: .continuous
                            )
                        )

                    Button("Not Yet", action: onNotYet)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.82))
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 24)
        }
        .scrollIndicators(.hidden)
    }

    @ViewBuilder
    private var summaryPills: some View {
        updatePill(
            title: "Files",
            value: "\(summary.assetCount)",
            systemImage: "doc.on.doc.fill"
        )
        updatePill(
            title: "Update Size",
            value: summary.sizeText,
            systemImage: "arrow.down.circle.fill"
        )
        updatePill(
            title: "Estimated Time",
            value: summary.durationText,
            systemImage: "clock.fill"
        )
    }

    private var groupedCandidates: [(name: String, files: [String])] {
        let groups = Dictionary(grouping: summary.candidates) { candidate in
            candidate.asset.filename.split(separator: "/").first.map(String.init)
                ?? "Course Files"
        }
        return groups.map { name, candidates in
            (
                name: name,
                files: candidates.map {
                    $0.asset.filename.split(separator: "/").last.map(String.init)
                        ?? $0.asset.filename
                }
                .sorted()
            )
        }
        .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    private func updatePill(
        title: String,
        value: String,
        systemImage: String
    ) -> some View {
        VStack(spacing: 5) {
            Label(title, systemImage: systemImage)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.58))

            Text(value)
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.84)
        }
        .frame(maxWidth: .infinity, minHeight: 72)
        .padding(.horizontal, 8)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
}

private enum LaunchExperienceMode: Equatable {
    case startup
    case practice
}

private struct LaunchExperienceView: View {
    let mode: LaunchExperienceMode
    let onFinished: () -> Void

    @State private var showsLogo = false
    @State private var settlesLogo = false
    @State private var fadesOut = false

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()

                switch mode {
                case .startup:
                    startupContent(proxy: proxy)
                case .practice:
                    practiceContent(proxy: proxy)
                }
            }
            .opacity(fadesOut ? 0 : 1)
            .onAppear {
                if mode == .startup {
                    runLaunchSequence()
                } else {
                    showsLogo = true
                }
            }
        }
    }

    private func startupContent(proxy: GeometryProxy) -> some View {
        ZStack {
            dummiesAnimation(size: 160)
                .opacity(settlesLogo ? 0 : 1)
                .scaleEffect(showsLogo ? 0.72 : 1)
                .position(
                    x: proxy.size.width / 2,
                    y: showsLogo ? proxy.size.height / 2 + 86 : proxy.size.height / 2
                )

            BrandHeader(logoHeight: settlesLogo ? 66 : 100)
                .frame(maxWidth: settlesLogo ? 420 : 560)
                .position(
                    x: proxy.size.width / 2,
                    y: settlesLogo ? proxy.safeAreaInsets.top + 46 : proxy.size.height / 2 - 74
                )
                .opacity(showsLogo ? 1 : 0)
        }
    }

    private func practiceContent(proxy: GeometryProxy) -> some View {
        ZStack(alignment: .topTrailing) {
            VStack(spacing: 28) {
                HeartbeatBrandHeader(logoHeight: 110)
                    .frame(maxWidth: 560)

                dummiesAnimation(size: 188)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 28)
            .opacity(showsLogo ? 1 : 0)

            Button {
                onFinished()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.12))
                    .clipShape(Circle())
                    .overlay {
                        Circle()
                            .stroke(.white.opacity(0.16), lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close launch screen")
            .padding(.top, proxy.safeAreaInsets.top + 12)
            .padding(.trailing, 18)
        }
    }

    private func dummiesAnimation(size: CGFloat) -> some View {
        LoopingVideoView(resourceName: "DummiesDoingCPR", fileExtension: "mp4")
            .frame(width: size, height: size)
            .clipShape(Circle())
            .overlay {
                Circle()
                    .stroke(.white.opacity(0.18), lineWidth: 1)
            }
    }

    private func runLaunchSequence() {
        Task {
            try? await Task.sleep(nanoseconds: 450_000_000)
            withAnimation(.easeOut(duration: 0.45)) {
                showsLogo = true
            }

            try? await Task.sleep(nanoseconds: 1_650_000_000)
            withAnimation(.spring(response: 0.62, dampingFraction: 0.86)) {
                settlesLogo = true
            }

            try? await Task.sleep(nanoseconds: 650_000_000)
            withAnimation(.easeInOut(duration: 0.32)) {
                fadesOut = true
            }

            try? await Task.sleep(nanoseconds: 340_000_000)
            await MainActor.run {
                onFinished()
            }
        }
    }
}
