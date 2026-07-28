import Foundation

struct RemoteContentManifest: Equatable, Sendable {
    struct Asset: Equatable, Sendable {
        let key: String
        let version: RemoteAssetVersion
    }

    let generatedAt: Date?
    let assetsByKey: [String: Asset]
}

actor RemoteContentManifestClient {
    static let shared = RemoteContentManifestClient(
        endpoint: URLHelpers.mediaBaseURL.appendingPathComponent("api/manifest")
    )

    private struct Payload: Decodable {
        struct File: Decodable {
            let key: String
            let etag: String?
            let uploaded: String?
            let size: Int64
        }

        let generated: String?
        let files: [File]
    }

    private let endpoint: URL
    private let session: URLSession
    private let maximumResponseBytes = 2 * 1_024 * 1_024
    private var inFlight: Task<RemoteContentManifest?, Never>?
    private var cachedManifest: RemoteContentManifest?
    private var cachedAt: Date?

    init(endpoint: URL) {
        self.endpoint = endpoint
        let configuration = URLSessionConfiguration.ephemeral
        configuration.waitsForConnectivity = false
        configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 30
        self.session = URLSession(configuration: configuration)
    }

    func fetch(
        cacheInterval: TimeInterval = 60 * 60,
        forceRefresh: Bool = false
    ) async -> RemoteContentManifest? {
        if !forceRefresh,
           let cachedManifest,
           let cachedAt,
           Date().timeIntervalSince(cachedAt) < cacheInterval {
            return cachedManifest
        }
        if let inFlight {
            return await inFlight.value
        }

        let endpoint = endpoint
        let session = session
        let maximumResponseBytes = maximumResponseBytes
        let task = Task<RemoteContentManifest?, Never> {
            guard endpoint.scheme?.lowercased() == "https" else { return nil }
            do {
                var request = URLRequest(url: endpoint)
                request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
                request.timeoutInterval = 15
                request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
                request.setValue("application/json", forHTTPHeaderField: "Accept")

                let (bytes, response) = try await session.bytes(for: request)
                guard let response = response as? HTTPURLResponse,
                      response.statusCode == 200,
                      response.mimeType == "application/json" || response.mimeType == nil,
                      response.expectedContentLength <= Int64(maximumResponseBytes)
                else {
                    return nil
                }

                var data = Data()
                data.reserveCapacity(
                    min(maximumResponseBytes, max(0, Int(response.expectedContentLength)))
                )
                var chunk: [UInt8] = []
                chunk.reserveCapacity(16 * 1_024)
                var receivedByteCount = 0
                for try await byte in bytes {
                    guard receivedByteCount < maximumResponseBytes else { return nil }
                    chunk.append(byte)
                    receivedByteCount += 1
                    if chunk.count >= 16 * 1_024 {
                        data.append(contentsOf: chunk)
                        chunk.removeAll(keepingCapacity: true)
                    }
                }
                if !chunk.isEmpty {
                    data.append(contentsOf: chunk)
                }

                return Self.decodePayload(data)
            } catch {
                return nil
            }
        }

        inFlight = task
        let result = await task.value
        inFlight = nil
        if let result {
            cachedManifest = result
            cachedAt = Date()
        }
        return result
    }

    nonisolated static func decodePayload(
        _ data: Data
    ) -> RemoteContentManifest? {
        guard let payload = try? JSONDecoder().decode(Payload.self, from: data) else {
            return nil
        }
        var assetsByKey: [String: RemoteContentManifest.Asset] = [:]
        assetsByKey.reserveCapacity(payload.files.count)
        for file in payload.files {
            guard !file.key.isEmpty,
                  !file.key.hasPrefix("/"),
                  !file.key.split(separator: "/").contains(".."),
                  file.size > 0,
                  assetsByKey[file.key] == nil
            else {
                return nil
            }
            assetsByKey[file.key] = .init(
                key: file.key,
                version: .init(
                    byteCount: file.size,
                    eTag: file.etag,
                    lastModified: file.uploaded
                )
            )
        }
        guard !assetsByKey.isEmpty else { return nil }

        let generatedAt = payload.generated.flatMap { value -> Date? in
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [
                .withInternetDateTime,
                .withFractionalSeconds
            ]
            return fractional.date(from: value)
                ?? ISO8601DateFormatter().date(from: value)
        }
        return RemoteContentManifest(
            generatedAt: generatedAt,
            assetsByKey: assetsByKey
        )
    }
}

struct ContentUpdatePlanStore {
    struct WorkItem: Codable, Equatable {
        let candidate: ContentUpdateCandidate
        var attempt: Int
        var retryAfter: Date?
    }

    struct Plan: Codable, Equatable {
        var pending: [WorkItem]
        var failed: [ContentUpdateCandidate]
        var batchFingerprint: String
        var cellularApprovalFingerprint: String?

        var allowsCellularForBatch: Bool {
            !batchFingerprint.isEmpty
                && cellularApprovalFingerprint == batchFingerprint
        }

        init(
            pending: [WorkItem],
            failed: [ContentUpdateCandidate],
            allowsCellularForBatch: Bool = false
        ) {
            self.pending = pending
            self.failed = failed
            self.batchFingerprint = Self.fingerprint(for: pending)
            self.cellularApprovalFingerprint = allowsCellularForBatch
                ? batchFingerprint
                : nil
        }

        private enum CodingKeys: String, CodingKey {
            case pending
            case failed
            case batchFingerprint
            case cellularApprovalFingerprint
            case allowsCellularForBatch
        }

        init(from decoder: Decoder) throws {
            let values = try decoder.container(keyedBy: CodingKeys.self)
            pending = try values.decode([WorkItem].self, forKey: .pending)
            failed = try values.decode([ContentUpdateCandidate].self, forKey: .failed)
            let calculatedFingerprint = Self.fingerprint(for: pending)
            batchFingerprint = try values.decodeIfPresent(
                String.self,
                forKey: .batchFingerprint
            ) ?? calculatedFingerprint
            cellularApprovalFingerprint = try values.decodeIfPresent(
                String.self,
                forKey: .cellularApprovalFingerprint
            )
            if cellularApprovalFingerprint != batchFingerprint {
                cellularApprovalFingerprint = nil
            }

            // A legacy unscoped boolean cannot prove which candidate set the
            // user approved, so it is intentionally not carried forward.
            _ = try values.decodeIfPresent(
                Bool.self,
                forKey: .allowsCellularForBatch
            )
        }

        func encode(to encoder: Encoder) throws {
            var values = encoder.container(keyedBy: CodingKeys.self)
            try values.encode(pending, forKey: .pending)
            try values.encode(failed, forKey: .failed)
            try values.encode(batchFingerprint, forKey: .batchFingerprint)
            try values.encodeIfPresent(
                cellularApprovalFingerprint,
                forKey: .cellularApprovalFingerprint
            )
        }

        static func fingerprint(for pending: [WorkItem]) -> String {
            ContentUpdateSummary(
                candidates: pending.map(\.candidate)
            ).fingerprint
        }
    }

    private struct StorePayload: Codable {
        let schemaVersion: Int
        let plan: Plan
    }

    private let fileManager: FileManager
    private let explicitStoreURL: URL?
    private let contentRevision: String
    private let explicitSupportDirectoryURL: URL?

    init(
        fileManager: FileManager = .default,
        storeURL: URL? = nil,
        contentRevision: String = "experiment-3.0",
        supportDirectoryURL: URL? = nil
    ) {
        self.fileManager = fileManager
        self.explicitStoreURL = storeURL
        self.contentRevision = contentRevision
        self.explicitSupportDirectoryURL = supportDirectoryURL
    }

    func load() throws -> Plan? {
        let url = try resolvedStoreURL()
        guard fileManager.fileExists(atPath: url.path) else { return nil }
        let data = try Data(contentsOf: url)
        let payload = try JSONDecoder().decode(StorePayload.self, from: data)
        guard payload.schemaVersion == 1 else { return nil }
        return payload.plan
    }

    func save(_ plan: Plan) throws {
        let url = try resolvedStoreURL()
        try fileManager.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let payload = StorePayload(schemaVersion: 1, plan: plan)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(payload)
        try data.write(to: url, options: [.atomic])
        try excludeFromBackup(url)
    }

    func remove() throws {
        let url = try resolvedStoreURL()
        guard fileManager.fileExists(atPath: url.path) else { return }
        try fileManager.removeItem(at: url)
    }

    @discardableResult
    func migrateObsoleteFilenames(using catalog: TrainingCatalog) throws -> Bool {
        guard var plan = try load() else { return false }
        let assets = Dictionary(
            catalog.packages.flatMap(\.assets).map { ($0.filename, $0) },
            uniquingKeysWith: { first, _ in first }
        )

        let migratedPending = plan.pending.compactMap { item -> WorkItem? in
            guard let asset = ContentFilenameAliases.canonicalAsset(
                item.candidate.asset,
                catalogAssetsByFilename: assets
            ) else {
                return nil
            }
            return WorkItem(
                candidate: ContentUpdateCandidate(
                    asset: asset,
                    remoteVersion: item.candidate.remoteVersion
                ),
                attempt: item.attempt,
                retryAfter: item.retryAfter
            )
        }
        let migratedFailed = plan.failed.compactMap { candidate -> ContentUpdateCandidate? in
            guard let asset = ContentFilenameAliases.canonicalAsset(
                candidate.asset,
                catalogAssetsByFilename: assets
            ) else {
                return nil
            }
            return ContentUpdateCandidate(
                asset: asset,
                remoteVersion: candidate.remoteVersion
            )
        }
        guard migratedPending != plan.pending || migratedFailed != plan.failed else {
            return false
        }
        plan.pending = migratedPending
        plan.failed = migratedFailed
        plan.batchFingerprint = Plan.fingerprint(for: migratedPending)
        plan.cellularApprovalFingerprint = nil
        try save(plan)
        return true
    }

    private func resolvedStoreURL() throws -> URL {
        if let explicitStoreURL {
            return explicitStoreURL
        }

        let supportURL: URL
        if let explicitSupportDirectoryURL {
            try fileManager.createDirectory(
                at: explicitSupportDirectoryURL,
                withIntermediateDirectories: true
            )
            supportURL = explicitSupportDirectoryURL
        } else {
            supportURL = try fileManager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
        }

        let sanitized = contentRevision.replacingOccurrences(
            of: "[^A-Za-z0-9._-]",
            with: "-",
            options: .regularExpression
        )
        let revision = sanitized.isEmpty ? "current" : sanitized
        return supportURL
            .appendingPathComponent("ContentUpdates-\(revision)", isDirectory: true)
            .appendingPathComponent("plan.json", isDirectory: false)
    }

    private func excludeFromBackup(_ url: URL) throws {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutableURL.setResourceValues(values)
    }
}

@MainActor
final class ContentUpdateService: NSObject, ObservableObject {
    private struct ActiveUpdate {
        let workItem: ContentUpdatePlanStore.WorkItem
    }

    private struct TaskDescription: Codable {
        let workItem: ContentUpdatePlanStore.WorkItem
    }

    private let storageService: StorageService
    private let versionStore: ContentVersionStore
    private let planStore: ContentUpdatePlanStore
    private let manifestClient: RemoteContentManifestClient
    private let backgroundSessionIdentifier: String
    private let maxConcurrentUpdates = 3
    private let maxRetryAttempts = 3
    private var lastSuccessfulCheckAt: Date?
    private var lastFailedCheckAt: Date?
    private var dismissedFingerprint: String?
    private var plan: ContentUpdatePlanStore.Plan?
    private var activeUpdates: [Int: ActiveUpdate] = [:]
    private var retryWakeTask: Task<Void, Never>?
    private var networkPolicy = TransferNetworkPolicySnapshot(
        isKnown: false,
        isSatisfied: true,
        isExpensive: false,
        allowsCellular: false
    )

    @Published private(set) var availableUpdate: ContentUpdateSummary?
    @Published private(set) var isChecking = false
    @Published private(set) var isUpdating = false
    @Published private(set) var completedUpdateCount = 0
    @Published private(set) var totalUpdateCount = 0
    @Published private(set) var isWaitingForWiFi = false
    @Published private(set) var lastErrorMessage: String?

    var onAvailableUpdate: ((ContentUpdateSummary?) -> Void)?

    private lazy var updateSession: URLSession = {
        #if targetEnvironment(simulator)
        let configuration = URLSessionConfiguration.default
        #else
        let configuration = URLSessionConfiguration.background(
            withIdentifier: backgroundSessionIdentifier
        )
        configuration.sessionSendsLaunchEvents = true
        #endif
        configuration.isDiscretionary = false
        configuration.waitsForConnectivity = true
        configuration.httpMaximumConnectionsPerHost = maxConcurrentUpdates
        configuration.allowsConstrainedNetworkAccess = true
        configuration.allowsExpensiveNetworkAccess = true
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 60
        configuration.timeoutIntervalForResource = 3_600
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    init(
        storageService: StorageService,
        versionStore: ContentVersionStore,
        planStore: ContentUpdatePlanStore,
        contentRevision: String
    ) {
        self.storageService = storageService
        self.versionStore = versionStore
        self.planStore = planStore
        self.manifestClient = .shared
        let revisionComponent = contentRevision.replacingOccurrences(
            of: "[^A-Za-z0-9.-]",
            with: "-",
            options: .regularExpression
        )
        self.backgroundSessionIdentifier =
            "com.ehacademy.cpr-trainer-pro.content-updates.\(revisionComponent)"
        super.init()
        loadPlan()
        _ = updateSession
        recoverBackgroundTasks()
    }

    func checkForUpdates(packages: [DownloadPackage], baseURL: URL) async {
        let now = Date()
        if let lastSuccessfulCheckAt,
           now.timeIntervalSince(lastSuccessfulCheckAt) < 60 * 60 {
            publishPersistedFailuresIfNeeded()
            return
        }
        if let lastFailedCheckAt,
           now.timeIntervalSince(lastFailedCheckAt) < 60 {
            publishPersistedFailuresIfNeeded()
            return
        }
        guard !isChecking else { return }
        guard !isUpdating else { return }

        let activeFilenames = Set(activeUpdates.values.map(\.workItem.candidate.asset.filename))
        let pendingFilenames = Set(plan?.pending.map(\.candidate.asset.filename) ?? [])
        let persistedFailures = persistedFailuresForDownloadedAssets()
        let uniqueAssets = Self.uniqueRemoteAssets(in: packages)
            .filter { asset in
                !activeFilenames.contains(asset.filename)
                    && !pendingFilenames.contains(asset.filename)
                    && storageService.fileExists(asset)
            }

        guard !uniqueAssets.isEmpty else {
            publishPersistedFailuresIfNeeded()
            return
        }

        do {
            try versionStore.adoptBundledVersionsIfNeeded(uniqueAssets)
        } catch {
            assertionFailure("Failed to adopt bundled media versions: \(error)")
        }

        isChecking = true
        defer { isChecking = false }

        guard let manifest = await manifestClient.fetch() else {
            lastFailedCheckAt = Date()
            publishPersistedFailuresIfNeeded()
            return
        }
        lastSuccessfulCheckAt = Date()
        lastFailedCheckAt = nil

        var checkedFilenames: [String] = []
        var candidates: [ContentUpdateCandidate] = []

        for asset in uniqueAssets {
            guard let remoteVersion = manifest.assetsByKey[asset.filename]?.version else {
                continue
            }
            checkedFilenames.append(asset.filename)
            guard
                let installedVersion = versionStore.installedVersion(for: asset.filename),
                remoteVersion.representsUpdate(comparedTo: installedVersion)
            else {
                continue
            }
            candidates.append(
                ContentUpdateCandidate(asset: asset, remoteVersion: remoteVersion)
            )
        }

        do {
            try versionStore.markChecked(filenames: checkedFilenames)
        } catch {
            assertionFailure("Failed to save media check time: \(error)")
        }

        // Fresh manifest results replace an older failed candidate if the same
        // object changed again between update attempts.
        let mergedCandidates = Self.deduplicatedCandidates(
            persistedFailures + candidates
        )
        publishAvailableUpdate(mergedCandidates)
    }

    @discardableResult
    func beginAvailableUpdates(
        _ summary: ContentUpdateSummary,
        allowsCellularForBatch: Bool = false
    ) -> Bool {
        guard !summary.candidates.isEmpty else { return false }
        guard diskPreflightAllows(summary.candidates) else { return false }

        var nextPlan = plan ?? .init(pending: [], failed: [])
        let hadApprovalForExistingBatch = nextPlan.allowsCellularForBatch
        let alreadyPending = Set(nextPlan.pending.map(\.candidate.asset.filename))
        let activeFilenames = Set(activeUpdates.values.map(\.workItem.candidate.asset.filename))

        for candidate in summary.candidates
        where !alreadyPending.contains(candidate.asset.filename)
            && !activeFilenames.contains(candidate.asset.filename) {
            nextPlan.pending.append(
                ContentUpdatePlanStore.WorkItem(
                    candidate: candidate,
                    attempt: 0,
                    retryAfter: nil
                )
            )
        }

        let enqueuedFilenames = Set(summary.candidates.map(\.asset.filename))
        nextPlan.failed.removeAll {
            enqueuedFilenames.contains($0.asset.filename)
        }
        let nextBatchFingerprint = ContentUpdatePlanStore.Plan.fingerprint(
            for: nextPlan.pending
        )
        let preservesExistingApproval = hadApprovalForExistingBatch
            && nextPlan.batchFingerprint == nextBatchFingerprint
        nextPlan.batchFingerprint = nextBatchFingerprint
        if allowsCellularForBatch,
           summary.fingerprint == nextBatchFingerprint {
            nextPlan.cellularApprovalFingerprint = nextBatchFingerprint
        } else if !preservesExistingApproval {
            nextPlan.cellularApprovalFingerprint = nil
        }

        plan = nextPlan
        availableUpdate = nil
        onAvailableUpdate?(nil)
        lastErrorMessage = nil
        completedUpdateCount = 0
        totalUpdateCount = Self.uniqueWorkCount(
            pending: nextPlan.pending,
            active: activeUpdates.values.map(\.workItem)
        )
        isUpdating = !nextPlan.pending.isEmpty || !activeUpdates.isEmpty
        savePlan()
        pumpQueue()
        return true
    }

    func dismissAvailableUpdate() {
        dismissedFingerprint = availableUpdate?.fingerprint
        availableUpdate = nil
        onAvailableUpdate?(nil)
    }

    func synchronizeForegroundState() {
        recoverBackgroundTasks()
    }

    func applyNetworkPolicy(_ policy: TransferNetworkPolicySnapshot) {
        networkPolicy = policy
        let isAllowed = effectiveNetworkAllowsTransfers
        isWaitingForWiFi = !isAllowed && (
            !activeUpdates.isEmpty || plan?.pending.isEmpty == false
        )
        if isAllowed {
            pumpQueue()
        } else {
            pauseActiveTransfersForNetworkPolicy()
        }
    }

    private var effectiveNetworkAllowsTransfers: Bool {
        guard networkPolicy.isKnown else { return true }
        guard networkPolicy.isSatisfied else { return false }
        return !networkPolicy.isExpensive
            || plan?.allowsCellularForBatch == true
    }

    private var allowsExpensiveTransfersForCurrentPlan: Bool {
        plan?.allowsCellularForBatch == true
    }

    private func pauseActiveTransfersForNetworkPolicy() {
        let taskIdentifiers = Set(activeUpdates.keys)
        guard !taskIdentifiers.isEmpty else { return }

        for taskIdentifier in taskIdentifiers {
            activeUpdates[taskIdentifier] = nil
        }
        updateSession.getAllTasks { tasks in
            for task in tasks where taskIdentifiers.contains(task.taskIdentifier) {
                task.cancel()
            }
        }
        isWaitingForWiFi = true
        isUpdating = plan?.pending.isEmpty == false
        savePlan()
    }

    private func loadPlan() {
        do {
            plan = try planStore.load()
            let pendingCount = plan?.pending.count ?? 0
            totalUpdateCount = pendingCount
            isUpdating = pendingCount > 0
        } catch {
            plan = nil
            isUpdating = false
            try? planStore.remove()
            assertionFailure("Failed to load content update plan: \(error)")
        }
    }

    private func diskPreflightAllows(
        _ candidates: [ContentUpdateCandidate]
    ) -> Bool {
        let remainingBytes = candidates.reduce(Int64(0)) {
            $0 + max(0, $1.remoteVersion.byteCount)
        }
        guard remainingBytes > 0,
              let availableBytes = storageService.availableDiskBytes()
        else {
            return true
        }

        let largestAsset = candidates
            .map(\.remoteVersion.byteCount)
            .max() ?? 0
        let safetyMargin = max(Int64(100_000_000), remainingBytes / 10)
        let requiredBytes = remainingBytes + largestAsset + safetyMargin
        guard availableBytes >= requiredBytes else {
            let formatter = ByteCountFormatter()
            formatter.countStyle = .file
            lastErrorMessage =
                "These updates need \(formatter.string(fromByteCount: requiredBytes)), "
                + "but \(formatter.string(fromByteCount: availableBytes)) is available."
            return false
        }
        return true
    }

    private func recoverBackgroundTasks() {
        updateSession.getAllTasks { [weak self] tasks in
            Task { @MainActor in
                guard let self else { return }
                self.restore(tasks)
                self.pumpQueue()
            }
        }
    }

    private func restore(_ tasks: [URLSessionTask]) {
        for task in tasks {
            guard
                let description = task.taskDescription,
                let decoded = try? decodeTaskDescription(description)
            else {
                continue
            }

            guard ContentFilenameAliases.canonicalFilename(
                decoded.workItem.candidate.asset.filename
            ) == decoded.workItem.candidate.asset.filename else {
                task.cancel()
                continue
            }

            activeUpdates[task.taskIdentifier] = ActiveUpdate(
                workItem: decoded.workItem
            )

            if plan?.pending.contains(where: {
                $0.candidate.asset.filename
                    == decoded.workItem.candidate.asset.filename
            }) != true {
                if plan == nil {
                    plan = .init(pending: [], failed: [])
                }
                plan?.pending.append(decoded.workItem)
            }
        }

        let hasWork = !activeUpdates.isEmpty || plan?.pending.isEmpty == false
        isUpdating = hasWork
        totalUpdateCount = max(
            totalUpdateCount,
            Self.uniqueWorkCount(
                pending: plan?.pending ?? [],
                active: activeUpdates.values.map(\.workItem)
            )
        )
        if hasWork {
            savePlan()
        }
    }

    private func pumpQueue() {
        guard var currentPlan = plan else {
            finishPlanIfNeeded()
            return
        }
        guard effectiveNetworkAllowsTransfers else {
            isUpdating = !currentPlan.pending.isEmpty || !activeUpdates.isEmpty
            isWaitingForWiFi = isUpdating
            return
        }
        isWaitingForWiFi = false

        let now = Date()
        var activeFilenames = Set(
            activeUpdates.values.map(\.workItem.candidate.asset.filename)
        )
        var changed = false

        while activeUpdates.count < maxConcurrentUpdates {
            guard let index = currentPlan.pending.firstIndex(where: { item in
                !activeFilenames.contains(item.candidate.asset.filename)
                    && (item.retryAfter == nil || item.retryAfter! <= now)
            }) else {
                break
            }

            let workItem = currentPlan.pending[index]
            guard storageService.fileExists(workItem.candidate.asset) else {
                currentPlan.pending.remove(at: index)
                changed = true
                continue
            }

            do {
                var request = URLRequest(
                    url: Self.versionedRemoteURL(
                        forExactFilename: workItem.candidate.asset.filename,
                        baseURL: URLHelpers.mediaBaseURL,
                        version: workItem.candidate.remoteVersion
                    )
                )
                request.cachePolicy = .reloadIgnoringLocalCacheData
                request.timeoutInterval = 60
                request.allowsExpensiveNetworkAccess =
                    allowsExpensiveTransfersForCurrentPlan
                request.setValue(
                    "CPRTrainerPro-iOS/0.1",
                    forHTTPHeaderField: "User-Agent"
                )

                let task = updateSession.downloadTask(with: request)
                task.taskDescription = try encodeTaskDescription(
                    TaskDescription(workItem: workItem)
                )
                activeUpdates[task.taskIdentifier] = ActiveUpdate(
                    workItem: workItem
                )
                activeFilenames.insert(workItem.candidate.asset.filename)
                isUpdating = true
                task.resume()
            } catch {
                currentPlan.pending.remove(at: index)
                currentPlan.failed.append(workItem.candidate)
                lastErrorMessage = error.localizedDescription
                changed = true
            }
        }

        plan = currentPlan
        if changed {
            savePlan()
        }
        scheduleRetryWakeIfNeeded()
        finishPlanIfNeeded()
    }

    private func finishDownload(
        taskIdentifier: Int,
        temporaryURL: URL,
        response: URLResponse?
    ) {
        guard let activeUpdate = activeUpdates[taskIdentifier] else {
            try? FileManager.default.removeItem(at: temporaryURL)
            return
        }
        let candidate = activeUpdate.workItem.candidate

        guard let httpResponse = response as? HTTPURLResponse,
              200..<300 ~= httpResponse.statusCode,
              let receivedVersion = RemoteAssetVersion(response: httpResponse),
              candidate.remoteVersion.matches(receivedVersion)
        else {
            try? FileManager.default.removeItem(at: temporaryURL)
            refreshVersionAfterMismatch(
                taskIdentifier: taskIdentifier,
                message: "The course file changed while it was downloading. It will be checked again."
            )
            return
        }

        do {
            try storageService.moveDownloadedFile(
                from: temporaryURL,
                for: candidate.asset,
                expectedByteCount: candidate.remoteVersion.byteCount
            )

            do {
                try versionStore.recordInstalled(
                    filename: candidate.asset.filename,
                    version: receivedVersion
                )
            } catch {
                assertionFailure("Failed to save installed media version: \(error)")
            }

            activeUpdates[taskIdentifier] = nil
            removePending(filename: candidate.asset.filename)
            completedUpdateCount += 1
            savePlan()
            pumpQueue()
        } catch {
            try? FileManager.default.removeItem(at: temporaryURL)
            handleFailure(
                taskIdentifier: taskIdentifier,
                message: error.localizedDescription
            )
        }
    }

    private func completeWithError(taskIdentifier: Int, error: Error?) {
        guard let error, activeUpdates[taskIdentifier] != nil else { return }
        handleFailure(
            taskIdentifier: taskIdentifier,
            message: error.localizedDescription
        )
    }

    private func handleFailure(taskIdentifier: Int, message: String) {
        guard let activeUpdate = activeUpdates.removeValue(
            forKey: taskIdentifier
        ) else {
            return
        }
        recordFailure(activeUpdate.workItem, message: message)
    }

    private func refreshVersionAfterMismatch(
        taskIdentifier: Int,
        message: String
    ) {
        guard let activeUpdate = activeUpdates.removeValue(
            forKey: taskIdentifier
        ) else {
            return
        }
        let workItem = activeUpdate.workItem
        let filename = workItem.candidate.asset.filename
        let nextAttempt = workItem.attempt + 1
        guard nextAttempt < maxRetryAttempts else {
            recordFailure(workItem, message: message)
            return
        }

        Task { [weak self] in
            guard let self else { return }
            let manifest = await self.manifestClient.fetch(forceRefresh: true)
            guard
                let refreshedVersion = manifest?.assetsByKey[filename]?.version,
                var currentPlan = self.plan,
                let index = currentPlan.pending.firstIndex(where: {
                    $0.candidate.asset.filename == filename
                })
            else {
                self.recordFailure(workItem, message: message)
                return
            }

            currentPlan.pending[index] = .init(
                candidate: .init(
                    asset: workItem.candidate.asset.replacingRemoteVersion(
                        refreshedVersion
                    ),
                    remoteVersion: refreshedVersion
                ),
                attempt: nextAttempt,
                retryAfter: nil
            )
            self.plan = currentPlan
            self.savePlan()
            self.pumpQueue()
        }
    }

    private func recordFailure(
        _ failedWorkItem: ContentUpdatePlanStore.WorkItem,
        message: String
    ) {
        let filename = failedWorkItem.candidate.asset.filename
        guard var currentPlan = plan,
              let index = currentPlan.pending.firstIndex(where: {
                  $0.candidate.asset.filename == filename
              })
        else {
            pumpQueue()
            return
        }

        var workItem = currentPlan.pending[index]
        workItem.attempt += 1
        lastErrorMessage = "\(filename): \(message)"

        if workItem.attempt >= maxRetryAttempts {
            currentPlan.pending.remove(at: index)
            currentPlan.failed.removeAll {
                $0.asset.filename == filename
            }
            currentPlan.failed.append(workItem.candidate)
        } else {
            let delay = min(8, pow(2, Double(workItem.attempt - 1)))
            workItem.retryAfter = Date().addingTimeInterval(delay)
            currentPlan.pending[index] = workItem
        }

        plan = currentPlan
        savePlan()
        pumpQueue()
    }

    private func removePending(filename: String) {
        plan?.pending.removeAll {
            $0.candidate.asset.filename == filename
        }
        plan?.failed.removeAll {
            $0.asset.filename == filename
        }
    }

    private func scheduleRetryWakeIfNeeded() {
        retryWakeTask?.cancel()

        let activeFilenames = Set(
            activeUpdates.values.map(\.workItem.candidate.asset.filename)
        )
        guard let retryDate = plan?.pending
            .filter({
                !activeFilenames.contains($0.candidate.asset.filename)
                    && $0.retryAfter != nil
            })
            .compactMap(\.retryAfter)
            .min()
        else {
            retryWakeTask = nil
            return
        }

        let delay = max(0, retryDate.timeIntervalSinceNow)
        retryWakeTask = Task { [weak self] in
            try? await Task.sleep(
                nanoseconds: UInt64(delay * 1_000_000_000)
            )
            guard !Task.isCancelled else { return }
            self?.pumpQueue()
        }
    }

    private func finishPlanIfNeeded() {
        guard activeUpdates.isEmpty, plan?.pending.isEmpty != false else {
            isUpdating = true
            return
        }

        isUpdating = false
        retryWakeTask?.cancel()
        retryWakeTask = nil

        let failed = plan?.failed ?? []
        if failed.isEmpty {
            plan = nil
            try? planStore.remove()
            lastErrorMessage = nil
        } else {
            savePlan()
            publishAvailableUpdate(failed)
        }
    }

    private func savePlan() {
        guard let plan else {
            try? planStore.remove()
            return
        }

        do {
            try planStore.save(plan)
        } catch {
            assertionFailure("Failed to save content update plan: \(error)")
        }
    }

    private func publishPersistedFailuresIfNeeded() {
        let failed = persistedFailuresForDownloadedAssets()
        guard !failed.isEmpty else { return }
        publishAvailableUpdate(failed)
    }

    private func persistedFailuresForDownloadedAssets() -> [ContentUpdateCandidate] {
        let failed = plan?.failed ?? []
        let downloadedFailures = failed.filter {
            storageService.fileExists($0.asset)
        }
        guard downloadedFailures.count != failed.count else {
            return downloadedFailures
        }

        plan?.failed = downloadedFailures
        if plan?.pending.isEmpty == true, downloadedFailures.isEmpty {
            plan = nil
        }
        savePlan()
        return downloadedFailures
    }

    private func publishAvailableUpdate(_ candidates: [ContentUpdateCandidate]) {
        let deduplicated = Self.deduplicatedCandidates(candidates)
        let summary = deduplicated.isEmpty
            ? nil
            : ContentUpdateSummary(candidates: deduplicated)
        if summary?.fingerprint == dismissedFingerprint {
            availableUpdate = nil
            onAvailableUpdate?(nil)
            return
        }
        availableUpdate = summary
        onAvailableUpdate?(summary)
    }

    private func encodeTaskDescription(_ description: TaskDescription) throws -> String {
        let data = try JSONEncoder().encode(description)
        return String(decoding: data, as: UTF8.self)
    }

    private func decodeTaskDescription(_ description: String) throws -> TaskDescription {
        try JSONDecoder().decode(
            TaskDescription.self,
            from: Data(description.utf8)
        )
    }

    nonisolated private static func stageDownloadedFile(
        from location: URL,
        taskIdentifier: Int
    ) throws -> URL {
        let fileManager = FileManager.default
        let stagingDirectory = fileManager.temporaryDirectory
            .appendingPathComponent(
                "CPRTrainerProContentUpdates",
                isDirectory: true
            )
        try fileManager.createDirectory(
            at: stagingDirectory,
            withIntermediateDirectories: true
        )

        let stagedURL = stagingDirectory
            .appendingPathComponent(
                "\(taskIdentifier)-\(UUID().uuidString)",
                isDirectory: false
            )
        try fileManager.moveItem(at: location, to: stagedURL)
        return stagedURL
    }

    nonisolated private static func uniqueRemoteAssets(
        in packages: [DownloadPackage]
    ) -> [MediaAsset] {
        var byFilename: [String: MediaAsset] = [:]
        for asset in packages.flatMap(\.assets) {
            byFilename[asset.filename] = asset
        }
        return byFilename.values.sorted {
            $0.filename.localizedStandardCompare($1.filename) == .orderedAscending
        }
    }

    nonisolated private static func deduplicatedCandidates(
        _ candidates: [ContentUpdateCandidate]
    ) -> [ContentUpdateCandidate] {
        var byFilename: [String: ContentUpdateCandidate] = [:]
        for candidate in candidates {
            byFilename[candidate.asset.filename] = candidate
        }
        return byFilename.values.sorted {
            $0.asset.filename.localizedStandardCompare(
                $1.asset.filename
            ) == .orderedAscending
        }
    }

    nonisolated private static func uniqueWorkCount(
        pending: [ContentUpdatePlanStore.WorkItem],
        active: [ContentUpdatePlanStore.WorkItem]
    ) -> Int {
        Set(
            (pending + active).map(\.candidate.asset.filename)
        ).count
    }

    nonisolated private static func remoteURL(
        forExactFilename filename: String,
        baseURL: URL
    ) -> URL {
        let clean = filename
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(
                of: "^/+",
                with: "",
                options: .regularExpression
            )

        return clean
            .split(separator: "/", omittingEmptySubsequences: true)
            .reduce(baseURL) { partialURL, component in
                partialURL.appendingPathComponent(
                    String(component),
                    isDirectory: false
                )
            }
    }

    nonisolated private static func versionedRemoteURL(
        forExactFilename filename: String,
        baseURL: URL,
        version: RemoteAssetVersion
    ) -> URL {
        let url = remoteURL(forExactFilename: filename, baseURL: baseURL)
        guard let eTag = version.eTag,
              var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else {
            return url
        }
        var queryItems = components.queryItems ?? []
        queryItems.removeAll { $0.name == "v" }
        queryItems.append(URLQueryItem(name: "v", value: eTag))
        components.queryItems = queryItems
        return components.url ?? url
    }
}

extension ContentUpdateService: URLSessionDownloadDelegate {
    nonisolated func urlSessionDidFinishEvents(
        forBackgroundURLSession session: URLSession
    ) {
        guard let identifier = session.configuration.identifier else { return }
        Task { @MainActor in
            ExternalDisplayAppDelegate.completeBackgroundSessionEvents(
                identifier: identifier
            )
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        let response = downloadTask.response

        do {
            let stagedURL = try Self.stageDownloadedFile(
                from: location,
                taskIdentifier: downloadTask.taskIdentifier
            )
            Task { @MainActor in
                self.finishDownload(
                    taskIdentifier: downloadTask.taskIdentifier,
                    temporaryURL: stagedURL,
                    response: response
                )
            }
        } catch {
            Task { @MainActor in
                self.completeWithError(
                    taskIdentifier: downloadTask.taskIdentifier,
                    error: error
                )
            }
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        Task { @MainActor in
            self.completeWithError(
                taskIdentifier: task.taskIdentifier,
                error: error
            )
        }
    }
}
