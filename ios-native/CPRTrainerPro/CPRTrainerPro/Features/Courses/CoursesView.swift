import SwiftUI

struct CoursesView: View {
    @EnvironmentObject private var appViewModel: AppViewModel
    @EnvironmentObject private var downloadService: DownloadService
    @State private var cprVAEnabled = false
    @State private var firstAidVAEnabled = false
    @State private var expandedCourseID: Course.ID?
    @State private var activeLaunch: CourseLaunchRequest?
    @State private var pendingDownloadPrompt: DownloadPromptContext?

    var body: some View {
        NavigationStack {
            StickyBrandScrollView(showsCourseSubtitle: true) {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(appViewModel.catalog.courses) { course in
                        courseSection(for: course)
                    }
                }
            }
            .navigationTitle("")
            .toolbar(.hidden, for: .navigationBar)
        }
        .fullScreenCover(item: $activeLaunch) { request in
            launchView(for: request.mode)
        }
        .alert(
            pendingDownloadPrompt?.title ?? "Course Not Downloaded",
            isPresented: Binding(
                get: { pendingDownloadPrompt != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingDownloadPrompt = nil
                    }
                }
            )
        ) {
            if let prompt = pendingDownloadPrompt, prompt.canStartDownload {
                Button("Download Now") {
                    downloadService.enqueue(prompt.package, baseURL: appViewModel.catalog.mediaBaseURL)
                    pendingDownloadPrompt = nil
                }
            }

            Button("Not Now", role: .cancel) {
                pendingDownloadPrompt = nil
            }
        } message: {
            Text(pendingDownloadPrompt?.message ?? "")
        }
    }

    @ViewBuilder
    private func courseSection(for course: Course) -> some View {
        let vaBinding = course.id == .cprAED ? $cprVAEnabled : $firstAidVAEnabled
        let selectedMode = appViewModel.primaryMode(for: course, vaEnabled: vaBinding.wrappedValue)
        let state = selectedMode.map { downloadService.state(for: $0.packageID) } ?? .notDownloaded

        VStack(alignment: .leading, spacing: 12) {
            CourseCard(
                course: course,
                selectedMode: selectedMode,
                downloadState: state,
                isSelected: appViewModel.selectedCourseID == course.id,
                isExpanded: expandedCourseID == course.id,
                onSelect: {
                    appViewModel.select(course)
                    withAnimation(.snappy(duration: 0.18)) {
                        expandedCourseID = expandedCourseID == course.id ? nil : course.id
                    }
                }
            )

            if appViewModel.selectedCourseID == course.id {
                modeControls(for: course, vaEnabled: vaBinding)

                PrimaryActionButton(
                    title: "Launch Course",
                    systemImage: "play.fill",
                    action: {
                        launchOrPromptDownload(
                            course: course,
                            mode: selectedMode,
                            state: state
                        )
                    }
                )
            }
        }
    }

    private func launchOrPromptDownload(course: Course, mode: CourseLaunchMode?, state: DownloadState) {
        guard
            let mode,
            let package = appViewModel.catalog.package(with: mode.packageID)
        else {
            return
        }

        if state.isReady {
            activeLaunch = CourseLaunchRequest(mode: mode)
            return
        }

        pendingDownloadPrompt = DownloadPromptContext(
            courseTitle: course.title,
            modeTitle: mode.kind == .video ? "Virtual Assistant" : mode.title,
            package: package,
            state: state
        )
    }

    @ViewBuilder
    private func modeControls(for course: Course, vaEnabled: Binding<Bool>) -> some View {
        VStack(spacing: 10) {
            if course.id == .firstAid {
                Toggle("Pediatric Focused", isOn: $appViewModel.firstAidPediatricFocused)
                    .tint(Theme.Colors.peach)
                    .onChange(of: appViewModel.firstAidPediatricFocused) { _, enabled in
                        if enabled {
                            firstAidVAEnabled = false
                        }
                    }
            }

            Toggle("Virtual Assistant?", isOn: vaEnabled)
                .tint(Theme.Colors.peach)
                .disabled(course.id == .firstAid && appViewModel.firstAidPediatricFocused)
                .opacity(course.id == .firstAid && appViewModel.firstAidPediatricFocused ? 0.45 : 1)
        }
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.white)
        .padding(14)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
    }

    @ViewBuilder
    private func launchView(for mode: CourseLaunchMode) -> some View {
        switch mode.kind {
        case .video:
            if let videoCourse = appViewModel.catalog.videoCourse(for: mode) {
                VideoCoursePlayerView(videoCourse: videoCourse, storageService: StorageService())
            } else {
                MissingLaunchView(title: "Video Course Missing")
            }
        case .slideshow:
            if let slideshow = appViewModel.catalog.slideshow(for: mode) {
                SlideshowPlayerView(slideshow: slideshow, storageService: StorageService())
            } else {
                MissingLaunchView(title: "Slideshow Missing")
            }
        }
    }
}

private struct CourseLaunchRequest: Identifiable {
    let mode: CourseLaunchMode

    var id: String {
        mode.id.rawValue
    }
}

private struct DownloadPromptContext: Identifiable {
    let courseTitle: String
    let modeTitle: String
    let package: DownloadPackage
    let state: DownloadState

    var id: String {
        package.id.rawValue
    }

    var title: String {
        state.isActiveDownload ? "Download In Progress" : "Course Not Downloaded"
    }

    var canStartDownload: Bool {
        !state.isActiveDownload
    }

    var message: String {
        if state.isActiveDownload {
            let progress = state.progressFraction.map { " Current progress: \(Int(($0 * 100).rounded()))%." } ?? ""
            return "\(courseTitle) is still downloading.\(progress) The course cannot launch until every required file is saved locally, which prevents playback from failing mid-class."
        }

        return "\(courseTitle) (\(modeTitle)) is not downloaded yet. This app launches courses only after all required media is stored locally so classroom playback remains smooth offline. This download is \(package.estimatedDownloadText). Download now?"
    }
}

private struct MissingLaunchView: View {
    @Environment(\.dismiss) private var dismiss
    let title: String

    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.largeTitle)
                    .foregroundStyle(Theme.Colors.warning)

                Text(title)
                    .font(.headline)
                    .foregroundStyle(.white)

                Text("The selected course mode is not available in the local manifest.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.68))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            .appBackground()
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }
            }
        }
    }
}
