import SwiftUI

struct SettingsView: View {
    @State private var activeModal: SettingsModal?

    var body: some View {
        NavigationStack {
            StickyBrandScrollView(title: "Settings") {
                VStack(alignment: .leading, spacing: 16) {
                    introCard
                    guideSection

                    SettingsActionRow(
                        title: "All Downloads",
                        subtitle: "Review, retry, delete, or download every offline media package.",
                        systemImage: "arrow.down.circle.fill",
                        accent: Theme.Colors.peach
                    ) {
                        activeModal = .downloads
                    }

                    SettingsActionRow(
                        title: "About & Recognition",
                        subtitle: "Copyright, proprietary notice, and national recognition statement.",
                        systemImage: "info.circle.fill",
                        accent: Theme.Colors.blue
                    ) {
                        activeModal = .about
                    }
                }
            }
            .navigationTitle("")
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(item: $activeModal) { modal in
            switch modal {
            case .guide(let guide):
                GuideDetailView(guide: guide)
                    .presentationDragIndicator(.visible)
            case .downloads:
                DownloadsView()
                    .presentationDragIndicator(.visible)
            case .about:
                AboutRecognitionView()
                    .presentationDragIndicator(.visible)
            }
        }
    }

    private var introCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: "questionmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(Theme.Colors.blue)
                    .frame(width: 34, height: 34)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Guides & How-To's")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)

                    Text("Use this area for app help, instructor standards, portal steps, downloads, and product information.")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.64))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .settingsSurface()
    }

    private var guideSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Guide Selection")
                .font(.title3.weight(.bold))
                .foregroundStyle(.white)

            ForEach(TrainingGuide.allCases) { guide in
                SettingsActionRow(
                    title: guide.title,
                    subtitle: guide.subtitle,
                    systemImage: guide.systemImage,
                    accent: guide.accent
                ) {
                    activeModal = .guide(guide)
                }
            }
        }
    }
}

private enum SettingsModal: Identifiable {
    case guide(TrainingGuide)
    case downloads
    case about

    var id: String {
        switch self {
        case .guide(let guide):
            "guide-\(guide.id)"
        case .downloads:
            "downloads"
        case .about:
            "about"
        }
    }
}

private enum TrainingGuide: String, CaseIterable, Identifiable {
    case app
    case teaching
    case portal

    var id: String { rawValue }

    var title: String {
        switch self {
        case .app:
            "Using the App"
        case .teaching:
            "Teaching a Course"
        case .portal:
            "Issuing Certifications"
        }
    }

    var subtitle: String {
        switch self {
        case .app:
            "Choose courses, launch media, use manuals, and prepare for offline training."
        case .teaching:
            "Review classroom ratios, timing guidance, manikin setup, and teaching modes."
        case .portal:
            "Walk through classes, rosters, attendance, pass status, and digital cards."
        }
    }

    var systemImage: String {
        switch self {
        case .app:
            "iphone.gen2"
        case .teaching:
            "person.3.fill"
        case .portal:
            "rosette"
        }
    }

    var accent: Color {
        switch self {
        case .app:
            Theme.Colors.red
        case .teaching:
            Theme.Colors.peach
        case .portal:
            Theme.Colors.blue
        }
    }

    var introduction: String {
        switch self {
        case .app:
            "This native iOS app was built for Everyday Hero Academy instructors as a reliable offline training platform. Download media before class, launch the correct mode quickly, and keep teaching even when classroom Wi-Fi is unreliable."
        case .teaching:
            "Use these reminders from the Everyday Hero Academy instructor materials to keep class delivery consistent, hands-on, and aligned with curriculum expectations."
        case .portal:
            "When class is complete, use the secure Everyday Hero Academy instructor portal to finalize attendance, mark passing students, and issue digital certification cards."
        }
    }

    var sections: [GuideSection] {
        switch self {
        case .app:
            [
                GuideSection(
                    title: "1. Choose the Course Tab",
                    body: "Use the bottom tabs to enter CPR/AED or First Aid. Each course tab contains its own course card, mode controls, and Launch Course button.",
                    bullets: [
                        "CPR/AED launches the CPR & AED course in slideshow mode by default.",
                        "First Aid launches the First Aid course by default.",
                        "Tap the course card to show or hide the course description."
                    ]
                ),
                GuideSection(
                    title: "2. Select the Teaching Mode",
                    body: "Slideshow is the default instructor-paced mode. Turn on Virtual Assistant when you want the narrated video course instead.",
                    bullets: [
                        "In First Aid, turn on Pediatric Focused to use the pediatric slideshow.",
                        "When Pediatric Focused is on, Virtual Assistant is disabled so the app launches the correct pediatric material."
                    ]
                ),
                GuideSection(
                    title: "3. Download Before Class",
                    body: "Courses launch only after every required file is stored locally. This protects the class from broken playback if internet drops mid-session.",
                    bullets: [
                        "Launch Course will prompt you to download if that course mode is missing.",
                        "Use Settings > All Downloads to review every package, retry failures, or remove ready packages."
                    ]
                ),
                GuideSection(
                    title: "4. Present and Navigate",
                    body: "Slideshows can be moved with arrows or swipes. Virtual Assistant videos use the chapter list and player controls.",
                    bullets: [
                        "Use the screen icon to cast through AirPlay when an external display is available.",
                        "Use fullscreen when the phone is rotated or when you need the course material to fill the screen."
                    ]
                ),
                GuideSection(
                    title: "5. Manuals and Certs",
                    body: "The Manuals tab stores instructor and student handbooks. The Send Certs tab opens the secure instructor portal when you are ready to issue cards.",
                    bullets: [
                        "If you are offline after class, keep an accurate roster and complete certification steps later at EHAcademy.com."
                    ]
                )
            ]
        case .teaching:
            [
                GuideSection(
                    title: "Instructor & Roster Limits",
                    body: "Standard class ratio is 12 students per instructor. If the class exceeds 12 students, a co-instructor or second teacher is required.",
                    bullets: [
                        "There is no student minimum; a class can be taught for one student.",
                        "Keep the roster accurate so certifications can be issued correctly."
                    ]
                ),
                GuideSection(
                    title: "Manikins & Feedback Devices",
                    body: "Maximum student-to-manikin ratio is 3:1. A 1:1 ratio is strongly recommended for better hands-on time and shorter class flow.",
                    bullets: [
                        "Standard curriculums require compression feedback devices.",
                        "Prestan-style feedback lights should indicate the correct 100-120 bpm compression rate.",
                        "Adult manikins should be placed on the floor for realistic mechanics.",
                        "If a student cannot kneel, place the manikin on a table or chair as an accommodation."
                    ]
                ),
                GuideSection(
                    title: "Official Teaching Times",
                    body: "Use these timing ranges as planning guidance for classroom pacing.",
                    bullets: [
                        "Comprehensive CPR AED & First Aid: 2.5 to 3 hours.",
                        "CPR AED core only: 1 hour 20 minutes to 2 hours.",
                        "First Aid core only: about 1 hour 15 minutes."
                    ]
                ),
                GuideSection(
                    title: "Video vs. Slideshow",
                    body: "Virtual Assistant video mode is useful for consistent pacing and narration. Slideshow mode is instructor-controlled and better when you want more room for questions, discussion, or custom pacing.",
                    bullets: [
                        "Use video mode when you want hands-free automation while monitoring student skills.",
                        "Use slideshow mode when you want to control every transition yourself."
                    ]
                )
            ]
        case .portal:
            [
                GuideSection(
                    title: "1. Access the Dashboard",
                    body: "Log in at www.ehacademy.com with your instructor credentials. From the dashboard, open Classes to manage courses and rosters.",
                    bullets: []
                ),
                GuideSection(
                    title: "2. Create a Class",
                    body: "On the Classes page, create a new class and enter the instructor, date, start time, location, and client details.",
                    bullets: [
                        "Use create-new links in the portal when a location or client needs to be saved for future classes."
                    ]
                ),
                GuideSection(
                    title: "3. Build the Roster",
                    body: "Add students individually or upload a CSV roster. Select the appropriate certificate type before submitting the class.",
                    bullets: []
                ),
                GuideSection(
                    title: "4. Confirm Attendance",
                    body: "Open the class details page after training and mark each physically present student as attended.",
                    bullets: []
                ),
                GuideSection(
                    title: "5. Issue Digital Cards",
                    body: "Mark successful students as passed, then send certificates to all students or to individual students as needed.",
                    bullets: [
                        "You can also download all certificates as a ZIP from the portal.",
                        "Certifications can only be issued by accounts with an active paid subscription or valid single-class purchase."
                    ]
                )
            ]
        }
    }
}

private struct GuideSection: Identifiable {
    let title: String
    let body: String
    let bullets: [String]

    var id: String { title }
}

private struct GuideDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let guide: TrainingGuide

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    GuideHeader(guide: guide)

                    ForEach(guide.sections) { section in
                        GuideSectionView(section: section, accent: guide.accent)
                    }
                }
                .padding(Theme.Layout.screenPadding)
                .padding(.bottom, 28)
            }
            .appBackground()
            .navigationTitle(guide.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }
            }
        }
    }
}

private struct GuideHeader: View {
    let guide: TrainingGuide

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: guide.systemImage)
                .font(.title.weight(.semibold))
                .foregroundStyle(guide.accent)
                .frame(width: 46, height: 46)
                .background(guide.accent.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.controlRadius, style: .continuous))

            Text(guide.title)
                .font(.title2.weight(.bold))
                .foregroundStyle(.white)

            Text(guide.introduction)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.70))
                .fixedSize(horizontal: false, vertical: true)
        }
        .settingsSurface()
    }
}

private struct GuideSectionView: View {
    let section: GuideSection
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(section.title)
                .font(.headline.weight(.bold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)

            Text(section.body)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.70))
                .fixedSize(horizontal: false, vertical: true)

            if !section.bullets.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(section.bullets, id: \.self) { bullet in
                        HStack(alignment: .top, spacing: 8) {
                            Circle()
                                .fill(accent)
                                .frame(width: 5, height: 5)
                                .padding(.top, 7)

                            Text(bullet)
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.72))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
        .settingsSurface()
    }
}

private struct AboutRecognitionView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    BrandHeader(logoHeight: 66)
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 2)

                    InfoBlock(
                        title: "About CPR Trainer Pro",
                        systemImage: "info.circle.fill",
                        accent: Theme.Colors.blue
                    ) {
                        Text("(c) 2025 Everyday Hero Academy Inc. All rights reserved. This software and all course materials are proprietary and protected by copyright law. Unauthorized reproduction, distribution, or use outside of EHA-approved training is strictly prohibited.")
                    }

                    InfoBlock(
                        title: "Standards & National Recognition",
                        systemImage: "checkmark.seal.fill",
                        accent: Theme.Colors.success
                    ) {
                        Text("Everyday Hero Academy provides nationally recognized, fully compliant CPR and First Aid certifications built strictly on the latest 2025 AHA/ILCOR scientific standards. Because our curriculum mandates live, in-person skills assessments, our pediatric and adult cards meet or exceed all federal OSHA workplace safety requirements and satisfy state child-care licensing mandates including pediatric hands-on skills validation. To view our comprehensive state-by-state approval registry or download your compliance packet, visit ehacademy.com")

                        Link(destination: URLHelpers.websiteURL) {
                            HStack(spacing: 8) {
                                Image(systemName: "safari.fill")
                                Text("Open ehacademy.com")
                            }
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Theme.Colors.blue)
                            .padding(.top, 2)
                        }
                    }
                }
                .padding(Theme.Layout.screenPadding)
                .padding(.bottom, 28)
            }
            .appBackground()
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }
            }
        }
    }
}

private struct InfoBlock<Content: View>: View {
    let title: String
    let systemImage: String
    let accent: Color
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .font(.headline)
                    .foregroundStyle(accent)
                    .frame(width: 28, height: 28)

                Text(title)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
            }

            content()
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.72))
                .fixedSize(horizontal: false, vertical: true)
        }
        .settingsSurface()
    }
}

private struct SettingsActionRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: systemImage)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(accent)
                    .frame(width: 34, height: 34)
                    .background(accent.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.controlRadius, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.62))
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white.opacity(0.58))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .settingsSurface()
    }
}

private extension View {
    func settingsSurface() -> some View {
        self
            .padding(16)
            .background(Theme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
    }
}
