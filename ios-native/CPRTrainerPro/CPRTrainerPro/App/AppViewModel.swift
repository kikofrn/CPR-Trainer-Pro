import Foundation

enum AppPrompt: Identifiable, Equatable {
    case initialDownload(DownloadContentEstimate)
    case contentUpdate(ContentUpdateSummary)

    var id: String {
        switch self {
        case .initialDownload:
            "initial-download"
        case .contentUpdate(let summary):
            "content-update-\(summary.id)"
        }
    }
}

@MainActor
final class AppViewModel: ObservableObject {
    @Published private(set) var catalog: TrainingCatalog
    @Published var selectedTab: AppTab = .cprAED
    @Published var selectedCourseID: Course.ID?
    @Published private(set) var cprVAEnabled = false
    @Published private(set) var cprPediatricFocused = false
    @Published private(set) var firstAidVAEnabled = false
    @Published private(set) var firstAidPediatricFocused = false
    @Published private(set) var activePrompt: AppPrompt?

    let storageService: StorageService
    let downloadService: DownloadService
    let contentUpdateService: ContentUpdateService
    private let versionStore: ContentVersionStore
    private var didEvaluateInitialDownloadPrompt = false
    private var pendingContentUpdate: ContentUpdateSummary?

    init(manifestService: ContentManifestService = .init()) {
        let catalog = manifestService.loadBundledCatalog()
        let versionStore = ContentVersionStore(
            contentRevision: catalog.contentRevision
        )
        let storageService = StorageService(
            contentRevision: catalog.contentRevision,
            versionStore: versionStore
        )
        let queueStore = DownloadQueueStore(contentRevision: catalog.contentRevision)
        let downloadAllQueueStore = DownloadAllQueueStore(
            contentRevision: catalog.contentRevision
        )
        let contentUpdatePlanStore = ContentUpdatePlanStore(
            contentRevision: catalog.contentRevision
        )
        let contentUpdateService = ContentUpdateService(
            storageService: storageService,
            versionStore: versionStore,
            planStore: contentUpdatePlanStore,
            contentRevision: catalog.contentRevision
        )

        self.catalog = catalog
        self.versionStore = versionStore
        self.storageService = storageService
        self.downloadService = DownloadService(
            storageService: storageService,
            versionStore: versionStore,
            queueStore: queueStore,
            downloadAllQueueStore: downloadAllQueueStore,
            contentRevision: catalog.contentRevision
        )
        self.contentUpdateService = contentUpdateService
        self.selectedCourseID = catalog.courses.first?.id
        self.downloadService.refreshPackageStates(for: catalog.packages)
        self.contentUpdateService.onAvailableUpdate = { [weak self] summary in
            self?.receiveContentUpdate(summary)
        }
        if let availableUpdate = contentUpdateService.availableUpdate {
            receiveContentUpdate(availableUpdate)
        }
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
        contentUpdateService.synchronizeForegroundState()
    }

    var remainingDownloadEstimate: DownloadContentEstimate? {
        catalog.remainingDownloadEstimate(fileExists: storageService.fileExists)
    }

    func presentInitialDownloadPromptIfNeeded() {
        guard !didEvaluateInitialDownloadPrompt else { return }

        didEvaluateInitialDownloadPrompt = true
        if
            !downloadService.isDownloadingAll,
            let estimate = remainingDownloadEstimate
        {
            activePrompt = .initialDownload(estimate)
        } else {
            presentPendingContentUpdateIfPossible()
        }

        Task {
            await contentUpdateService.checkForUpdates(
                packages: catalog.packages,
                baseURL: catalog.mediaBaseURL
            )
        }
    }

    func dismissInitialDownloadPrompt() {
        if case .initialDownload = activePrompt {
            activePrompt = nil
        }
        presentPendingContentUpdateAfterDismissal()
    }

    func downloadAllContent() {
        guard remainingDownloadEstimate != nil else {
            if case .initialDownload = activePrompt {
                activePrompt = nil
            }
            presentPendingContentUpdateAfterDismissal()
            return
        }

        downloadService.enqueueAll(
            catalog.packages,
            baseURL: catalog.mediaBaseURL
        )
        if case .initialDownload = activePrompt {
            activePrompt = nil
        }
        presentPendingContentUpdateAfterDismissal()
    }

    func beginContentUpdate(_ summary: ContentUpdateSummary) {
        pendingContentUpdate = nil
        activePrompt = nil
        contentUpdateService.beginAvailableUpdates(summary)
    }

    func dismissContentUpdatePrompt() {
        pendingContentUpdate = nil
        activePrompt = nil
        contentUpdateService.dismissAvailableUpdate()
    }

    func dismissActivePrompt() {
        switch activePrompt {
        case .initialDownload:
            dismissInitialDownloadPrompt()
        case .contentUpdate:
            dismissContentUpdatePrompt()
        case nil:
            break
        }
    }

    private func receiveContentUpdate(_ summary: ContentUpdateSummary?) {
        pendingContentUpdate = summary
        presentPendingContentUpdateIfPossible()
    }

    private func presentPendingContentUpdateAfterDismissal() {
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            self?.presentPendingContentUpdateIfPossible()
        }
    }

    private func presentPendingContentUpdateIfPossible() {
        guard
            didEvaluateInitialDownloadPrompt,
            activePrompt == nil,
            let pendingContentUpdate
        else {
            return
        }

        activePrompt = .contentUpdate(pendingContentUpdate)
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
