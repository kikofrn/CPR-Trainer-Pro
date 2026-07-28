import SwiftUI

struct CoursesView: View {
    let courseID: Course.ID
    let title: String
    var showsBrandLogo = true
    var onHeaderProgressChange: ((CGFloat) -> Void)? = nil

    @EnvironmentObject private var appViewModel: AppViewModel
    @EnvironmentObject private var downloadService: DownloadService
    @State private var activeLaunch: CourseLaunchRequest?
    @State private var pendingDownloadPrompt: DownloadPromptContext?
    @State private var experienceToken: ForegroundExperienceToken?

    var body: some View {
        NavigationStack {
            StickyBrandScrollView(
                title: title,
                showsBrandLogo: showsBrandLogo,
                onHeaderProgressChange: onHeaderProgressChange
            ) {
                if let course = appViewModel.catalog.courses.first(where: { $0.id == courseID }) {
                    VStack(alignment: .leading, spacing: 10) {
                        courseSection(for: course)
                    }
                } else {
                    MissingCourseView()
                }
            }
            .navigationTitle("")
            .toolbar(.hidden, for: .navigationBar)
        }
        .fullScreenCover(item: $activeLaunch, onDismiss: releaseExperience) { request in
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
        let selectedMode = appViewModel.primaryMode(for: course)
        let isComingSoon = appViewModel.isUnavailableModeSelected(for: course.id)
        let state = selectedMode?.packageID.map(downloadService.state) ?? .notDownloaded
        let cardCopy = courseCardCopy(for: course, selectedMode: selectedMode)

        VStack(alignment: .leading, spacing: 12) {
            CourseCard(
                course: course,
                selectedMode: selectedMode,
                copy: cardCopy,
                downloadState: state,
                isComingSoon: isComingSoon,
                isSelected: true,
                onSelect: {},
                onStatusTap: {
                    launchOrPromptDownload(
                        course: course,
                        mode: selectedMode,
                        state: state
                    )
                }
            )

            modeControls(for: course)

            if isComingSoon {
                Text("To launch the Pediatric course, disable the Virtual Assistant.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.78))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(Theme.Colors.surface)
                    .clipShape(
                        RoundedRectangle(
                            cornerRadius: Theme.Layout.cardRadius,
                            style: .continuous
                        )
                    )
            } else {
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
            mode.isAvailable,
            let packageID = mode.packageID,
            let package = appViewModel.catalog.package(with: packageID)
        else {
            return
        }

        if appViewModel.storageService.packageHasRequiredContent(package) {
            experienceToken = appViewModel.acquireForegroundExperience("course")
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

    private func releaseExperience() {
        appViewModel.releaseForegroundExperience(experienceToken)
        experienceToken = nil
    }

    @ViewBuilder
    private func modeControls(for course: Course) -> some View {
        let vaBinding = Binding(
            get: { appViewModel.vaEnabled(for: course.id) },
            set: { appViewModel.setVAEnabled($0, for: course.id) }
        )
        let pediatricBinding = Binding(
            get: { appViewModel.pediatricFocused(for: course.id) },
            set: { appViewModel.setPediatricFocused($0, for: course.id) }
        )
        VStack(spacing: 10) {
            Toggle("Pediatric Focused?", isOn: pediatricBinding)
                .tint(Theme.Colors.peach)

            Toggle("Enable Virtual Assistant?", isOn: vaBinding)
                .tint(Theme.Colors.peach)
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
            if !mode.isAvailable {
                MissingLaunchView(title: "Coming Soon")
            } else if let videoCourse = appViewModel.catalog.videoCourse(for: mode) {
                VideoCoursePlayerView(
                    videoCourse: videoCourse,
                    storageService: appViewModel.storageService
                )
            } else {
                MissingLaunchView(title: "Video Course Missing")
            }
        case .slideshow:
            if !mode.isAvailable {
                MissingLaunchView(title: "Coming Soon")
            } else if let slideshow = appViewModel.catalog.slideshow(for: mode) {
                SlideshowPlayerView(
                    slideshow: slideshow,
                    storageService: appViewModel.storageService
                )
            } else {
                MissingLaunchView(title: "Slideshow Missing")
            }
        }
    }

    private func courseCardCopy(for course: Course, selectedMode: CourseLaunchMode?) -> CourseCardCopy {
        let isVideo = selectedMode?.kind == .video
        let isPediatric = selectedMode?.id == .pediatricSlideshow
            || selectedMode?.id == .pediatricCPRSlideshow
        let title: String

        if selectedMode?.id == .pediatricCPRSlideshow {
            title = "Pediatric CPR & AED"
        } else if selectedMode?.id == .pediatricSlideshow {
            title = "Pediatric First Aid"
        } else {
            title = course.title
        }

        return CourseCardCopy(
            title: title,
            modeTitle: modeTitle(for: course, selectedMode: selectedMode),
            bluebellBubbles: bluebellBubbles(
                for: course,
                isVideo: isVideo,
                isPediatric: isPediatric
            ),
            collapsibleDescription: collapsibleDescription(for: course, isPediatric: isPediatric)
        )
    }

    private func bluebellBubbles(
        for course: Course,
        isVideo: Bool,
        isPediatric: Bool
    ) -> [String] {
        if isPediatric, course.id == .cprAED {
            return Self.pediatricCPRBluebellBubbles
        }

        if isPediatric {
            return Self.pediatricFirstAidBluebellBubbles
        }

        return isVideo ? Self.videoBluebellBubbles : Self.slideshowBluebellBubbles
    }

    private func modeTitle(for course: Course, selectedMode: CourseLaunchMode?) -> String {
        guard let selectedMode else { return "Select Mode" }

        if selectedMode.kind == .video {
            return "Video style"
        }

        return "Slideshow style"
    }

    private func collapsibleDescription(for course: Course, isPediatric: Bool) -> String {
        if course.id == .cprAED, isPediatric {
            return Self.pediatricCPRCertificationDescription
        }

        if course.id == .cprAED {
            return Self.cprCertificationDescription
        }

        if isPediatric {
            return Self.pediatricCertificationDescription
        }

        return Self.firstAidCertificationDescription
    }
}

private extension CoursesView {
    static let slideshowBluebellBubbles = [
        "Teach at your own pace",
        "Includes slide-by-slide teaching tips"
    ]

    static let videoBluebellBubbles = [
        "Narrated course guided by a virtual assistant",
        "Hands-free automation for classroom delivery"
    ]

    static let pediatricCPRBluebellBubbles = [
        "Pediatric Focused CPR & AED Certification",
        "Designed for childcare providers & teachers",
        "Covers Child & Infant CPR",
        "Interactive slides with practice cues"
    ]

    static let pediatricFirstAidBluebellBubbles = [
        "Pediatric Focused First Aid Certification",
        "Designed for childcare providers & teachers",
        "Covers common pediatric emergencies",
        "Interactive slides with practice cues"
    ]

    static let cprCertificationDescription = "Course content includes Adult, Child, and Infant CPR as well as choking relief. This is a full certification course built strictly on the latest 2025 AHA/ILCOR guidelines. All certifications meet or exceed federal OSHA workplace safety requirements and satisfy state licensing mandates including pediatric hands-on skills validation. Official certification cards are valid for 2 years and can only be issued through the EHAcademy.com web portal by an approved EHAcademy Instructor with valid credentials."

    static let pediatricCPRCertificationDescription = "Course content focuses on Child and Infant CPR, AED use, and choking relief. This is a full pediatric certification course built strictly on the latest 2025 AHA/ILCOR guidelines. All certifications meet or exceed federal OSHA workplace safety requirements and satisfy state licensing mandates including pediatric hands-on skills validation. Official certification cards are valid for 2 years and can only be issued through the EHAcademy.com web portal by an approved EHAcademy Instructor with valid credentials."

    static let firstAidCertificationDescription = "Course content includes up-to-date First Aid education for all ages. This is a full certification course built strictly on the latest 2025 AHA/ILCOR guidelines. All certifications meet or exceed federal OSHA workplace safety requirements and satisfy state licensing mandates including pediatric hands-on skills validation. Official certification cards are valid for 2 years and can only be issued through the EHAcademy.com web portal by an approved EHAcademy Instructor with valid credentials."

    static let pediatricCertificationDescription = "Course content includes up-to-date pediatric First Aid education. This is a full certification course built strictly on the latest 2025 AHA/ILCOR guidelines. All certifications meet or exceed federal OSHA workplace safety requirements and satisfy state licensing mandates including pediatric hands-on skills validation. Official certification cards are valid for 2 years and can only be issued through the EHAcademy.com web portal by an approved EHAcademy Instructor with valid credentials."
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
            let progressText = state.progressSnapshot.map { " Current progress: \($0.percentText)." } ?? ""
            let etaText = state.progressSnapshot?.etaText.map { " Estimated time remaining: \($0)." } ?? ""
            return "\(courseTitle) is still downloading.\(progressText)\(etaText) The course cannot launch until every required file is saved locally, which prevents playback from failing mid-class."
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

private struct MissingCourseView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.largeTitle)
                .foregroundStyle(Theme.Colors.warning)

            Text("Course Missing")
                .font(.headline)
                .foregroundStyle(.white)

            Text("The selected course is not available in the local manifest.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.68))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
    }
}
