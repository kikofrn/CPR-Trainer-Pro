import Foundation

struct ContentUpdatePlanStore {
    struct WorkItem: Codable, Equatable {
        let candidate: ContentUpdateCandidate
        var attempt: Int
        var retryAfter: Date?
    }

    struct Plan: Codable, Equatable {
        var pending: [WorkItem]
        var failed: [ContentUpdateCandidate]
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
    private let backgroundSessionIdentifier: String
    private let maxConcurrentChecks = 4
    private let maxConcurrentUpdates = 3
    private let maxRetryAttempts = 3
    private var didCheckThisLaunch = false
    private var plan: ContentUpdatePlanStore.Plan?
    private var activeUpdates: [Int: ActiveUpdate] = [:]
    private var retryWakeTask: Task<Void, Never>?

    @Published private(set) var availableUpdate: ContentUpdateSummary?
    @Published private(set) var isChecking = false
    @Published private(set) var isUpdating = false
    @Published private(set) var completedUpdateCount = 0
    @Published private(set) var totalUpdateCount = 0
    @Published private(set) var lastErrorMessage: String?

    var onAvailableUpdate: ((ContentUpdateSummary?) -> Void)?

    private lazy var checkSession: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.waitsForConnectivity = false
        configuration.httpMaximumConnectionsPerHost = maxConcurrentChecks
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 20
        return URLSession(configuration: configuration)
    }()

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
        guard !didCheckThisLaunch else {
            publishPersistedFailuresIfNeeded()
            return
        }
        didCheckThisLaunch = true

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

        var checkedFilenames: [String] = []
        var candidates: [ContentUpdateCandidate] = []

        for startIndex in stride(
            from: 0,
            to: uniqueAssets.count,
            by: maxConcurrentChecks
        ) {
            let endIndex = min(startIndex + maxConcurrentChecks, uniqueAssets.count)
            let batch = Array(uniqueAssets[startIndex..<endIndex])
            let results = await withTaskGroup(
                of: (MediaAsset, RemoteAssetVersion)?.self,
                returning: [(MediaAsset, RemoteAssetVersion)].self
            ) { group in
                for asset in batch {
                    let session = checkSession
                    group.addTask {
                        await Self.fetchRemoteVersion(
                            for: asset,
                            baseURL: baseURL,
                            session: session
                        )
                    }
                }

                var values: [(MediaAsset, RemoteAssetVersion)] = []
                for await result in group {
                    if let result {
                        values.append(result)
                    }
                }
                return values
            }

            for (asset, remoteVersion) in results {
                checkedFilenames.append(asset.filename)
                guard
                    let installedVersion = versionStore.installedVersion(
                        for: asset.filename
                    ),
                    remoteVersion.representsUpdate(comparedTo: installedVersion)
                else {
                    continue
                }

                candidates.append(
                    ContentUpdateCandidate(
                        asset: asset,
                        remoteVersion: remoteVersion
                    )
                )
            }
        }

        do {
            try versionStore.markChecked(filenames: checkedFilenames)
        } catch {
            assertionFailure("Failed to save media check time: \(error)")
        }

        // Put fresh HEAD results last so they replace an older failed candidate
        // if the same R2 object changed again between update attempts.
        let mergedCandidates = Self.deduplicatedCandidates(
            persistedFailures + candidates
        )
        publishAvailableUpdate(mergedCandidates)
    }

    func beginAvailableUpdates(_ summary: ContentUpdateSummary) {
        guard !summary.candidates.isEmpty else { return }

        var nextPlan = plan ?? .init(pending: [], failed: [])
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
    }

    func dismissAvailableUpdate() {
        availableUpdate = nil
        onAvailableUpdate?(nil)
    }

    func synchronizeForegroundState() {
        recoverBackgroundTasks()
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
                    url: Self.remoteURL(
                        forExactFilename: workItem.candidate.asset.filename,
                        baseURL: URLHelpers.mediaBaseURL
                    )
                )
                request.cachePolicy = .reloadIgnoringLocalCacheData
                request.timeoutInterval = 60
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
            handleFailure(
                taskIdentifier: taskIdentifier,
                message: "The R2 object changed while it was downloading. It will be checked again."
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

        let filename = activeUpdate.workItem.candidate.asset.filename
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

    nonisolated private static func fetchRemoteVersion(
        for asset: MediaAsset,
        baseURL: URL,
        session: URLSession
    ) async -> (MediaAsset, RemoteAssetVersion)? {
        let url = remoteURL(
            forExactFilename: asset.filename,
            baseURL: baseURL
        )

        do {
            var request = URLRequest(url: url)
            request.httpMethod = "HEAD"
            request.cachePolicy = .reloadIgnoringLocalCacheData
            request.timeoutInterval = 10
            request.setValue(
                "CPRTrainerPro-iOS/0.1",
                forHTTPHeaderField: "User-Agent"
            )

            var (_, response) = try await session.data(for: request)
            if let httpResponse = response as? HTTPURLResponse,
               [400, 403, 405, 501].contains(httpResponse.statusCode) {
                request.httpMethod = "GET"
                request.setValue(
                    "bytes=0-0",
                    forHTTPHeaderField: "Range"
                )
                (_, response) = try await session.data(for: request)
            }

            guard let httpResponse = response as? HTTPURLResponse,
                  200..<400 ~= httpResponse.statusCode,
                  let version = RemoteAssetVersion(response: httpResponse)
            else {
                return nil
            }
            return (asset, version)
        } catch {
            return nil
        }
    }

    nonisolated private static func uniqueRemoteAssets(
        in packages: [DownloadPackage]
    ) -> [MediaAsset] {
        var byFilename: [String: MediaAsset] = [:]
        for asset in packages.flatMap(\.assets) where asset.kind != .subtitle {
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
