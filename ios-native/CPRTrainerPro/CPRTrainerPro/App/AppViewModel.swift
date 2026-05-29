import Foundation

@MainActor
final class AppViewModel: ObservableObject {
    @Published private(set) var catalog: TrainingCatalog
    @Published var selectedTab: AppTab = .courses
    @Published var selectedCourseID: Course.ID?
    @Published var firstAidPediatricFocused = false

    let downloadService: DownloadService

    init(manifestService: ContentManifestService = .init()) {
        self.catalog = manifestService.loadBundledCatalog()
        self.downloadService = DownloadService()
        self.selectedCourseID = catalog.courses.first?.id
        self.downloadService.refreshPackageStates(for: catalog.packages)
    }

    var selectedCourse: Course? {
        guard let selectedCourseID else { return catalog.courses.first }
        return catalog.courses.first { $0.id == selectedCourseID }
    }

    func select(_ course: Course) {
        selectedCourseID = course.id
    }

    func primaryMode(for course: Course, vaEnabled: Bool) -> CourseLaunchMode? {
        if course.id == .firstAid && firstAidPediatricFocused {
            return course.modes.first { $0.id == .pediatricSlideshow }
        }

        let preferredKind: CourseLaunchMode.Kind = vaEnabled ? .video : .slideshow
        return course.modes.first { $0.kind == preferredKind }
    }
}

enum AppTab: Hashable {
    case courses
    case downloads
    case manuals
    case sendCerts
}
