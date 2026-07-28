import Foundation

struct ForegroundExperienceToken: Hashable {
    fileprivate let id = UUID()
}

enum AppPrompt: Identifiable, Equatable {
    case initialDownload(DownloadContentEstimate)
    case contentUpdate(ContentUpdateSummary)
    case cellularUpdateConfirmation(ContentUpdateSummary)

    var id: String {
        switch self {
        case .initialDownload:
            "initial-download"
        case .contentUpdate(let summary):
            "content-update-\(summary.id)"
        case .cellularUpdateConfirmation(let summary):
            "cellular-update-confirmation-\(summary.id)"
        }
    }
}

@MainActor
final class AppViewModel: ObservableObject {
    @Published private(set) var catalog: TrainingCatalog
    @Published var selectedTab: AppTab = .cprAED
    @Published private(set) var cprVAEnabled = UserDefaults.standard.bool(
        forKey: "courseMode.cpr.va"
    )
    @Published private(set) var cprPediatricFocused = UserDefaults.standard.bool(
        forKey: "courseMode.cpr.pediatric"
    )
    @Published private(set) var firstAidVAEnabled = UserDefaults.standard.bool(
        forKey: "courseMode.firstAid.va"
    )
    @Published private(set) var firstAidPediatricFocused = UserDefaults.standard.bool(
        forKey: "courseMode.firstAid.pediatric"
    )
    @Published private(set) var activePrompt: AppPrompt?

    let storageService: StorageService
    let downloadService: DownloadService
    let contentUpdateService: ContentUpdateService
    private let versionStore: ContentVersionStore
    private var didEvaluateInitialDownloadPrompt = false
    private var pendingContentUpdate: ContentUpdateSummary?
    private var foregroundExperienceTokens: [ForegroundExperienceToken: String] = [:]
    private var hourlyUpdateTask: Task<Void, Never>?

    init(manifestService: ContentManifestService = .init()) {
        let catalog = manifestService.loadBundledCatalog()
        let versionStore = ContentVersionStore(
            contentRevision: catalog.contentRevision
        )
        let storageService = StorageService(
            contentRevision: catalog.contentRevision,
            versionStore: versionStore
        )
        ContentStateMigrator(
            storageService: storageService,
            versionStore: versionStore
        ).migrate(using: catalog)
        let queueStore = DownloadQueueStore(contentRevision: catalog.contentRevision)
        let downloadAllQueueStore = DownloadAllQueueStore(
            contentRevision: catalog.contentRevision
        )
        let contentUpdatePlanStore = ContentUpdatePlanStore(
            contentRevision: catalog.contentRevision
        )
        do {
            try queueStore.migrateObsoleteFilenames(using: catalog)
            try contentUpdatePlanStore.migrateObsoleteFilenames(using: catalog)
        } catch {
            assertionFailure("Failed to migrate persisted content queues: \(error)")
        }
        let contentUpdateService = ContentUpdateService(
            storageService: storageService,
            versionStore: versionStore,
            planStore: contentUpdatePlanStore,
            contentRevision: catalog.contentRevision
        )
        let downloadService = DownloadService(
            storageService: storageService,
            versionStore: versionStore,
            queueStore: queueStore,
            downloadAllQueueStore: downloadAllQueueStore,
            contentRevision: catalog.contentRevision
        )

        self.catalog = catalog
        self.versionStore = versionStore
        self.storageService = storageService
        self.downloadService = downloadService
        self.contentUpdateService = contentUpdateService
        downloadService.onNetworkPolicyChange = { [weak contentUpdateService] policy in
            contentUpdateService?.applyNetworkPolicy(policy)
        }
        let policy = downloadService.transferPolicySnapshot
        contentUpdateService.applyNetworkPolicy(policy)
        self.downloadService.refreshPackageStates(for: catalog.packages)
        self.contentUpdateService.onAvailableUpdate = { [weak self] summary in
            self?.receiveContentUpdate(summary)
        }
        if let availableUpdate = contentUpdateService.availableUpdate {
            receiveContentUpdate(availableUpdate)
        }
        LegacyContentCleanup.schedule(for: catalog.contentRevision)
    }

    func appDidBecomeActive() {
        downloadService.synchronizeForegroundState(for: catalog.packages)
        contentUpdateService.synchronizeForegroundState()
        checkForContentUpdates()
        startHourlyUpdateChecks()
        presentPendingContentUpdateAfterDismissal()
    }

    func appDidEnterBackground() {
        hourlyUpdateTask?.cancel()
        hourlyUpdateTask = nil
    }

    func acquireForegroundExperience(_ reason: String) -> ForegroundExperienceToken {
        let token = ForegroundExperienceToken()
        foregroundExperienceTokens[token] = reason
        return token
    }

    func releaseForegroundExperience(_ token: ForegroundExperienceToken?) {
        guard let token else { return }
        foregroundExperienceTokens[token] = nil
        presentPendingContentUpdateAfterDismissal()
    }

    func downloadAllStateDidChange() {
        if !downloadService.isDownloadingAll {
            presentPendingContentUpdateAfterDismissal()
        }
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

        checkForContentUpdates()
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

        guard downloadService.enqueueAll(
            catalog.packages,
            baseURL: catalog.mediaBaseURL
        ) else {
            return
        }
        if case .initialDownload = activePrompt {
            activePrompt = nil
        }
        presentPendingContentUpdateAfterDismissal()
    }

    func requestContentUpdate(_ summary: ContentUpdateSummary) {
        let policy = downloadService.transferPolicySnapshot
        if policy.isConfirmedWiFi || (policy.isKnown && !policy.isSatisfied) {
            beginContentUpdate(summary, allowsCellularForBatch: false)
        } else {
            activePrompt = .cellularUpdateConfirmation(summary)
        }
    }

    func confirmCellularContentUpdate(_ summary: ContentUpdateSummary) {
        beginContentUpdate(summary, allowsCellularForBatch: true)
    }

    func cancelCellularContentUpdate(_ summary: ContentUpdateSummary) {
        activePrompt = .contentUpdate(summary)
    }

    private func beginContentUpdate(
        _ summary: ContentUpdateSummary,
        allowsCellularForBatch: Bool
    ) {
        guard contentUpdateService.beginAvailableUpdates(
            summary,
            allowsCellularForBatch: allowsCellularForBatch
        ) else { return }
        pendingContentUpdate = nil
        activePrompt = nil
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
        case .cellularUpdateConfirmation(let summary):
            cancelCellularContentUpdate(summary)
        case nil:
            break
        }
    }

    private func receiveContentUpdate(_ summary: ContentUpdateSummary?) {
        pendingContentUpdate = summary
        if let summary {
            switch activePrompt {
            case .contentUpdate:
                activePrompt = .contentUpdate(summary)
            case .cellularUpdateConfirmation:
                activePrompt = .cellularUpdateConfirmation(summary)
            default:
                break
            }
        } else {
            switch activePrompt {
            case .contentUpdate, .cellularUpdateConfirmation:
                activePrompt = nil
            default:
                break
            }
        }
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
            foregroundExperienceTokens.isEmpty,
            !downloadService.isDownloadingAll,
            let pendingContentUpdate
        else {
            return
        }

        activePrompt = .contentUpdate(pendingContentUpdate)
    }

    private func checkForContentUpdates() {
        Task { [weak self] in
            guard let self else { return }
            await self.contentUpdateService.checkForUpdates(
                packages: self.catalog.packages,
                baseURL: self.catalog.mediaBaseURL
            )
        }
    }

    private func startHourlyUpdateChecks() {
        guard hourlyUpdateTask == nil else { return }
        hourlyUpdateTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60 * 60 * 1_000_000_000)
                guard !Task.isCancelled, let self else { return }
                self.checkForContentUpdates()
            }
        }
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
            UserDefaults.standard.set(enabled, forKey: "courseMode.cpr.va")
        case .firstAid:
            firstAidVAEnabled = enabled
            UserDefaults.standard.set(enabled, forKey: "courseMode.firstAid.va")
        }
    }

    func setPediatricFocused(_ enabled: Bool, for courseID: Course.ID) {
        switch courseID {
        case .cprAED:
            cprPediatricFocused = enabled
            UserDefaults.standard.set(enabled, forKey: "courseMode.cpr.pediatric")
        case .firstAid:
            firstAidPediatricFocused = enabled
            UserDefaults.standard.set(enabled, forKey: "courseMode.firstAid.pediatric")
        }
    }

    func isUnavailableModeSelected(for courseID: Course.ID) -> Bool {
        guard let course = catalog.courses.first(where: { $0.id == courseID }) else {
            return false
        }
        return primaryMode(for: course)?.isAvailable == false
    }

    func primaryMode(for course: Course) -> CourseLaunchMode? {
        let modeID: CourseLaunchMode.ID
        switch (
            course.id,
            pediatricFocused(for: course.id),
            vaEnabled(for: course.id)
        ) {
        case (.cprAED, true, true):
            modeID = .pediatricCPRVideo
        case (.cprAED, true, false):
            modeID = .pediatricCPRSlideshow
        case (.cprAED, false, true):
            modeID = .cprVideo
        case (.cprAED, false, false):
            modeID = .cprSlideshow
        case (.firstAid, true, true):
            modeID = .pediatricFirstAidVideo
        case (.firstAid, true, false):
            modeID = .pediatricSlideshow
        case (.firstAid, false, true):
            modeID = .firstAidVideo
        case (.firstAid, false, false):
            modeID = .firstAidSlideshow
        }
        return course.modes.first { $0.id == modeID }
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

    var tabTitle: String {
        switch self {
        case .cprAED:
            "CPR/AED"
        case .firstAid:
            "First Aid"
        case .manuals:
            "Manuals"
        case .sendCerts:
            "Send Certs"
        case .settings:
            "Settings"
        }
    }

    var systemImageName: String {
        switch self {
        case .cprAED:
            "heart.text.square.fill"
        case .firstAid:
            "cross.case.fill"
        case .manuals:
            "book.closed.fill"
        case .sendCerts:
            "safari.fill"
        case .settings:
            "questionmark.circle.fill"
        }
    }

    var accessibilityIdentifier: String {
        switch self {
        case .cprAED:
            "cpr-aed"
        case .firstAid:
            "first-aid"
        case .manuals:
            "manuals"
        case .sendCerts:
            "send-certs"
        case .settings:
            "settings"
        }
    }

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
