import Foundation

@MainActor
final class AppViewModel: ObservableObject {
    @Published private(set) var catalog: TrainingCatalog
    @Published var selectedTab: AppTab = .cprAED
    @Published var selectedCourseID: Course.ID?
    @Published private(set) var cprVAEnabled = false
    @Published private(set) var cprPediatricFocused = false
    @Published private(set) var firstAidVAEnabled = false
    @Published private(set) var firstAidPediatricFocused = false
    @Published var initialDownloadPrompt: DownloadContentEstimate?

    let storageService: StorageService
    let downloadService: DownloadService
    private var didEvaluateInitialDownloadPrompt = false

    init(manifestService: ContentManifestService = .init()) {
        let catalog = manifestService.loadBundledCatalog()
        let storageService = StorageService(contentRevision: catalog.contentRevision)
        let queueStore = DownloadQueueStore(contentRevision: catalog.contentRevision)
        let downloadAllQueueStore = DownloadAllQueueStore(
            contentRevision: catalog.contentRevision
        )

        self.catalog = catalog
        self.storageService = storageService
        self.downloadService = DownloadService(
            storageService: storageService,
            queueStore: queueStore,
            downloadAllQueueStore: downloadAllQueueStore,
            contentRevision: catalog.contentRevision
        )
        self.selectedCourseID = catalog.courses.first?.id
        self.downloadService.refreshPackageStates(for: catalog.packages)
        LegacyContentCleanup.schedule(for: catalog.contentRevision)
    }

    var selectedCourse: Course? {
        guard let selectedCourseID else { return catalog.courses.first }
        return catalog.courses.first { $0.id == selectedCourseID }
    }

    func select(_ course: Course) {
        selectedCourseID = course.id
    }

    func synchronizeDownloadsAfterForeground() {
        downloadService.synchronizeForegroundState(for: catalog.packages)
    }

    var remainingDownloadEstimate: DownloadContentEstimate? {
        catalog.remainingDownloadEstimate(fileExists: storageService.fileExists)
    }

    func presentInitialDownloadPromptIfNeeded() {
        guard
            !didEvaluateInitialDownloadPrompt,
            !downloadService.isDownloadingAll
        else {
            return
        }

        didEvaluateInitialDownloadPrompt = true
        initialDownloadPrompt = remainingDownloadEstimate
    }

    func dismissInitialDownloadPrompt() {
        initialDownloadPrompt = nil
    }

    func downloadAllContent() {
        guard remainingDownloadEstimate != nil else {
            initialDownloadPrompt = nil
            return
        }

        downloadService.enqueueAll(
            catalog.packages,
            baseURL: catalog.mediaBaseURL
        )
        initialDownloadPrompt = nil
    }

    func vaEnabled(for courseID: Course.ID) -> Bool {
        switch courseID {
        case .cprAED:
            cprVAEnabled
        case .firstAid:
            firstAidVAEnabled
        }
    }

    func pediatricFocused(for courseID: Course.ID) -> Bool {
        switch courseID {
        case .cprAED:
            cprPediatricFocused
        case .firstAid:
            firstAidPediatricFocused
        }
    }

    func setVAEnabled(_ enabled: Bool, for courseID: Course.ID) {
        switch courseID {
        case .cprAED:
            cprVAEnabled = enabled
            if enabled {
                cprPediatricFocused = false
            }
        case .firstAid:
            firstAidVAEnabled = enabled
            if enabled {
                firstAidPediatricFocused = false
            }
        }
    }

    func setPediatricFocused(_ enabled: Bool, for courseID: Course.ID) {
        switch courseID {
        case .cprAED:
            cprPediatricFocused = enabled
            if enabled {
                cprVAEnabled = false
            }
        case .firstAid:
            firstAidPediatricFocused = enabled
            if enabled {
                firstAidVAEnabled = false
            }
        }
    }

    func primaryMode(for course: Course) -> CourseLaunchMode? {
        if pediatricFocused(for: course.id) {
            let pediatricModeID: CourseLaunchMode.ID =
                course.id == .cprAED ? .pediatricCPRSlideshow : .pediatricSlideshow
            return course.modes.first { $0.id == pediatricModeID }
        }

        let preferredKind: CourseLaunchMode.Kind =
            vaEnabled(for: course.id) ? .video : .slideshow
        return course.modes.first { $0.kind == preferredKind }
    }
}

private enum LegacyContentCleanup {
    private static let completedRevisionKey = "contentMigration.completedRevision"

    static func schedule(for contentRevision: String) {
        DispatchQueue.global(qos: .utility).async {
            let defaults = UserDefaults.standard
            guard defaults.string(forKey: completedRevisionKey) != contentRevision else { return }

            do {
                try StorageService(contentRevision: contentRevision).removeLegacyDownloadedMedia()
                try DownloadQueueStore(contentRevision: contentRevision).removeLegacyStore()
                defaults.set(contentRevision, forKey: completedRevisionKey)
            } catch {
                // Leave the marker unset so the safe, idempotent cleanup can retry next launch.
            }
        }
    }
}

enum AppTab: Hashable {
    case cprAED
    case firstAid
    case manuals
    case sendCerts
    case settings

    static let orderedTabs: [AppTab] = [
        .cprAED,
        .firstAid,
        .manuals,
        .sendCerts,
        .settings
    ]

    func adjacentTab(direction: Int) -> AppTab {
        guard
            let currentIndex = Self.orderedTabs.firstIndex(of: self),
            !Self.orderedTabs.isEmpty
        else {
            return self
        }

        let nextIndex = min(max(currentIndex + direction, 0), Self.orderedTabs.count - 1)
        return Self.orderedTabs[nextIndex]
    }
}
