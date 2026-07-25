import Foundation

@MainActor
final class DownloadService: NSObject, ObservableObject {
    private struct QueuedAsset: Equatable {
        let packageID: DownloadPackage.ID
        let asset: MediaAsset
        let remoteURL: URL
        let attempt: Int
    }

    private struct ActiveDownload {
        let packageID: DownloadPackage.ID
        let asset: MediaAsset
        let remoteURL: URL
        let attempt: Int
    }

    private struct ProgressSample {
        let date: Date
        let fractionComplete: Double
    }

    private struct ActiveAssetProgress {
        let bytesWritten: Int64
        let bytesExpected: Int64

        var fractionComplete: Double {
            guard bytesExpected > 0 else { return 0 }
            return max(0, min(1, Double(bytesWritten) / Double(bytesExpected)))
        }
    }

    private struct PackageProgress {
        var totalAssetCount: Int
        var completedAssetCount: Int
        var expectedByteCount: Int64 = 0
        var completedByteCount: Int64 = 0
        var activeAssetProgress: [String: ActiveAssetProgress] = [:]
        var samples: [ProgressSample] = []

        var fractionComplete: Double {
            let activeBytesWritten = activeAssetProgress.values.reduce(Int64(0)) { total, progress in
                total + max(0, progress.bytesWritten)
            }
            let activeBytesExpected = activeAssetProgress.values.reduce(Int64(0)) { total, progress in
                total + max(0, progress.bytesExpected)
            }
            let byteDenominator = max(expectedByteCount, completedByteCount + activeBytesExpected)

            if byteDenominator > 0 {
                let byteFraction = Double(max(0, completedByteCount) + activeBytesWritten)
                    / Double(byteDenominator)
                return min(0.99, max(0, byteFraction))
            }

            guard totalAssetCount > 0 else { return 1 }
            let activeTotal = activeAssetProgress.values.reduce(0) { total, progress in
                total + progress.fractionComplete
            }
            return min(0.99, (Double(completedAssetCount) + activeTotal) / Double(totalAssetCount))
        }

        var snapshot: DownloadProgressSnapshot {
            DownloadProgressSnapshot(
                fractionComplete: max(0, min(1, fractionComplete)),
                completedAssetCount: completedAssetCount,
                totalAssetCount: totalAssetCount,
                activeAssetCount: activeAssetProgress.count,
                etaSeconds: estimatedSecondsRemaining
            )
        }

        var estimatedSecondsRemaining: TimeInterval? {
            guard
                let current = samples.last,
                current.fractionComplete > 0,
                current.fractionComplete < 1
            else {
                return nil
            }

            guard let baseline = samples.dropLast().last(where: { sample in
                let elapsed = current.date.timeIntervalSince(sample.date)
                let progressDelta = current.fractionComplete - sample.fractionComplete
                return elapsed >= 3 && progressDelta >= 0.004
            }) else {
                return nil
            }

            let elapsed = current.date.timeIntervalSince(baseline.date)
            let progressDelta = current.fractionComplete - baseline.fractionComplete
            guard elapsed > 0, progressDelta > 0 else { return nil }

            let secondsRemaining = (1 - current.fractionComplete) / (progressDelta / elapsed)
            guard secondsRemaining.isFinite, secondsRemaining > 0, secondsRemaining < 86_400 else {
                return nil
            }

            return secondsRemaining
        }

        mutating func recordSample(at date: Date = Date()) {
            let nextFraction = max(0, min(1, fractionComplete))

            if let last = samples.last {
                let elapsed = date.timeIntervalSince(last.date)
                let progressDelta = abs(nextFraction - last.fractionComplete)
                guard progressDelta >= 0.001 || elapsed >= 5 else { return }
            }

            samples.append(ProgressSample(date: date, fractionComplete: nextFraction))

            let cutoff = date.addingTimeInterval(-45)
            samples.removeAll { $0.date < cutoff }
        }
    }

    private struct TaskDescription: Codable {
        let packageID: DownloadPackage.ID
        let asset: MediaAsset
    }

    private let storageService: StorageService
    private let queueStore: DownloadQueueStore
    private let backgroundSessionIdentifier: String
    private let maxConcurrentDownloads = 3
    private let maxRetryAttempts = 3
    private var queue: [QueuedAsset] = []
    private var activeDownloads: [Int: ActiveDownload] = [:]
    private var packageProgress: [DownloadPackage.ID: PackageProgress] = [:]
    private var persistedPlans: [DownloadPackage.ID: DownloadQueueStore.PackagePlan] = [:]
    private var knownPackages: [DownloadPackage.ID: DownloadPackage] = [:]
    private var progressTickerTask: Task<Void, Never>?

    @Published private var states: [DownloadPackage.ID: DownloadState] = [:]

    private lazy var session: URLSession = {
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
        configuration.httpMaximumConnectionsPerHost = maxConcurrentDownloads
        configuration.allowsConstrainedNetworkAccess = true
        configuration.allowsExpensiveNetworkAccess = true
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 60
        configuration.timeoutIntervalForResource = 3_600
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    init(
        storageService: StorageService = .init(),
        queueStore: DownloadQueueStore = .init(),
        contentRevision: String = "experiment-3.0"
    ) {
        self.storageService = storageService
        self.queueStore = queueStore
        let revisionComponent = contentRevision.replacingOccurrences(
            of: "[^A-Za-z0-9.-]",
            with: "-",
            options: .regularExpression
        )
        self.backgroundSessionIdentifier =
            "com.ehacademy.cpr-trainer-pro.background.\(revisionComponent)"
        super.init()
        loadPersistedPlans()
        _ = session
        recoverBackgroundTasks()
    }

    func state(for packageID: DownloadPackage.ID) -> DownloadState {
        states[packageID] ?? .notDownloaded
    }

    func downloadedSizeText(for package: DownloadPackage) -> String? {
        let byteCount = storageService.downloadedPackageByteCount(package)
        guard byteCount > 0 else { return nil }
        return ByteCountFormatter.string(fromByteCount: byteCount, countStyle: .file)
    }

    func refreshPackageStates(for packages: [DownloadPackage]) {
        remember(packages)

        for package in packages where storageService.packageIsReady(package) {
            states[package.id] = .ready
        }
    }

    func synchronizeForegroundState(for packages: [DownloadPackage]) {
        remember(packages)
        loadPersistedPlans()

        session.getAllTasks { [weak self] tasks in
            Task { @MainActor in
                guard let self else { return }

                self.restore(tasks)
                self.restorePersistedDownloads()
                self.refreshVisiblePackageProgress(for: packages, tasks: tasks)
                self.startProgressTickerIfNeeded()
            }
        }
    }

    func enqueue(_ package: DownloadPackage, baseURL: URL) {
        remember([package])

        if storageService.packageIsReady(package) {
            states[package.id] = .ready
            removePersistedPlan(package.id)
            return
        }

        let pendingAssets = package.assets.filter { !storageService.fileExists($0.filename) }
        guard !pendingAssets.isEmpty else {
            states[package.id] = .ready
            removePersistedPlan(package.id)
            return
        }

        persistPlan(for: package, baseURL: baseURL)
        states[package.id] = .queued
        var progress = PackageProgress(
            totalAssetCount: package.assets.count,
            completedAssetCount: package.assets.count - pendingAssets.count,
            expectedByteCount: package.estimatedDownloadBytes,
            completedByteCount: completedByteCount(for: package)
        )
        progress.recordSample()
        packageProgress[package.id] = progress

        let queuedAssets = pendingAssets.map { asset in
            QueuedAsset(
                packageID: package.id,
                asset: asset,
                remoteURL: Self.remoteURL(forExactFilename: asset.filename, baseURL: baseURL),
                attempt: 0
            )
        }

        queue.removeAll { $0.packageID == package.id }
        queue.append(contentsOf: queuedAssets)
        pumpQueue()
        startProgressTickerIfNeeded()
    }

    func cancel(_ packageID: DownloadPackage.ID) {
        queue.removeAll { $0.packageID == packageID }

        let taskIdentifiers = activeDownloads
            .filter { $0.value.packageID == packageID }
            .map(\.key)

        for taskIdentifier in taskIdentifiers {
            activeDownloads[taskIdentifier] = nil
        }

        session.getAllTasks { tasks in
            for task in tasks where taskIdentifiers.contains(task.taskIdentifier) {
                task.cancel()
            }
        }

        states[packageID] = .notDownloaded
        packageProgress[packageID] = nil
        removePersistedPlan(packageID)
        stopProgressTickerIfIdle()
    }

    func delete(_ package: DownloadPackage) {
        remember([package])
        cancel(package.id)

        do {
            try storageService.deletePackage(package)
            states[package.id] = .notDownloaded
        } catch {
            states[package.id] = .failed(message: error.localizedDescription)
        }
    }

    private func pumpQueue() {
        while activeDownloads.count < maxConcurrentDownloads, !queue.isEmpty {
            let next = queue.removeFirst()

            do {
                try storageService.prepareParentDirectory(for: next.asset.filename)
                var request = URLRequest(url: next.remoteURL)
                request.cachePolicy = .reloadIgnoringLocalCacheData
                request.timeoutInterval = 60
                request.setValue("CPRTrainerPro-iOS/0.1", forHTTPHeaderField: "User-Agent")
                let task = session.downloadTask(with: request)
                task.taskDescription = try encodeTaskDescription(
                    TaskDescription(packageID: next.packageID, asset: next.asset)
                )
                activeDownloads[task.taskIdentifier] = ActiveDownload(
                    packageID: next.packageID,
                    asset: next.asset,
                    remoteURL: next.remoteURL,
                    attempt: next.attempt
                )
                setPackageStateDownloading(next.packageID)
                task.resume()
            } catch {
                failPackage(next.packageID, message: message(for: error, asset: next.asset))
            }
        }
    }

    private func recoverBackgroundTasks() {
        session.getAllTasks { [weak self] tasks in
            Task { @MainActor in
                self?.restore(tasks)
                self?.restorePersistedDownloads()
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

            activeDownloads[task.taskIdentifier] = ActiveDownload(
                packageID: decoded.packageID,
                asset: decoded.asset,
                remoteURL: task.originalRequest?.url ?? task.currentRequest?.url ?? Self.remoteURL(
                    forExactFilename: decoded.asset.filename,
                    baseURL: URLHelpers.mediaBaseURL
                ),
                attempt: 0
            )
            if packageProgress[decoded.packageID] == nil {
                let package = persistedPlans[decoded.packageID]?.package ?? knownPackages[decoded.packageID]
                let totalAssetCount = package?.assets.count ?? 1
                let completedAssetCount = package?.assets.filter {
                    storageService.fileExists($0.filename)
                }.count ?? 0

                var progress = PackageProgress(
                    totalAssetCount: totalAssetCount,
                    completedAssetCount: completedAssetCount,
                    expectedByteCount: package?.estimatedDownloadBytes ?? 0,
                    completedByteCount: package.map { completedByteCount(for: $0) } ?? 0
                )
                progress.recordSample()
                packageProgress[decoded.packageID] = progress
            }

            setPackageStateDownloading(decoded.packageID)
        }
    }

    private func refreshVisiblePackageProgress(
        for packages: [DownloadPackage],
        tasks: [URLSessionTask]
    ) {
        for package in packages {
            if storageService.packageIsReady(package) {
                queue.removeAll { $0.packageID == package.id }
                states[package.id] = .ready
                packageProgress[package.id] = nil
                removePersistedPlan(package.id)
                continue
            }

            guard isTrackingDownload(for: package.id) else { continue }

            let completedAssetCount = package.assets.filter { storageService.fileExists($0.filename) }.count
            let activeAssetProgress = refreshedActiveAssetProgress(
                for: package.id,
                using: tasks,
                excludingCompletedAssetsIn: package
            )

            updatePackageProgress(
                package: package,
                packageID: package.id,
                totalAssetCount: package.assets.count,
                completedAssetCount: completedAssetCount,
                completedByteCount: completedByteCount(for: package),
                activeAssetProgress: activeAssetProgress
            )
            setPackageStateDownloading(package.id)
        }
    }

    private func refreshedActiveAssetProgress(
        for packageID: DownloadPackage.ID,
        using tasks: [URLSessionTask],
        excludingCompletedAssetsIn package: DownloadPackage
    ) -> [String: ActiveAssetProgress] {
        let completedFilenames = Set(
            package.assets
                .filter { storageService.fileExists($0.filename) }
                .map(\.filename)
        )

        var activeProgress = packageProgress[packageID]?.activeAssetProgress.filter {
            !completedFilenames.contains($0.key)
        } ?? [:]

        for task in tasks {
            guard
                let activeDownload = activeDownloads[task.taskIdentifier],
                activeDownload.packageID == packageID,
                !completedFilenames.contains(activeDownload.asset.filename)
            else {
                continue
            }

            let taskProgress = task.progress
            let bytesWritten = max(task.countOfBytesReceived, taskProgress.completedUnitCount, 0)
            let bytesExpected = max(task.countOfBytesExpectedToReceive, taskProgress.totalUnitCount, 0)

            if bytesWritten > 0 || bytesExpected > 0 {
                activeProgress[activeDownload.asset.filename] = ActiveAssetProgress(
                    bytesWritten: bytesWritten,
                    bytesExpected: bytesExpected
                )
            }
        }

        return activeProgress
    }

    private func restorePersistedDownloads() {
        guard !persistedPlans.isEmpty else { return }

        var shouldPumpQueue = false

        for plan in persistedPlans.values {
            let package = plan.package
            let activeFilenames = Set(
                activeDownloads.values
                    .filter { $0.packageID == package.id }
                    .map { $0.asset.filename }
            )
            let completedAssetCount = package.assets.filter { storageService.fileExists($0.filename) }.count
            let pendingAssets = package.assets.filter {
                !storageService.fileExists($0.filename) && !activeFilenames.contains($0.filename)
            }

            queue.removeAll { $0.packageID == package.id }

            if pendingAssets.isEmpty && activeFilenames.isEmpty {
                states[package.id] = .ready
                packageProgress[package.id] = nil
                removePersistedPlan(package.id)
                continue
            }

            updatePackageProgress(
                package: package,
                packageID: package.id,
                totalAssetCount: package.assets.count,
                completedAssetCount: completedAssetCount,
                completedByteCount: completedByteCount(for: package),
                activeAssetProgress: packageProgress[package.id]?.activeAssetProgress.filter {
                    activeFilenames.contains($0.key)
                } ?? [:]
            )

            if !pendingAssets.isEmpty {
                let queuedAssets = pendingAssets.map { asset in
                    QueuedAsset(
                        packageID: package.id,
                        asset: asset,
                        remoteURL: Self.remoteURL(forExactFilename: asset.filename, baseURL: plan.baseURL),
                        attempt: 0
                    )
                }

                queue.append(contentsOf: queuedAssets)
                shouldPumpQueue = true
            }

            if activeFilenames.isEmpty {
                states[package.id] = .queued
            } else {
                setPackageStateDownloading(package.id)
            }
        }

        if shouldPumpQueue {
            pumpQueue()
        }
    }

    private func handleProgress(
        taskIdentifier: Int,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        guard
            let activeDownload = activeDownloads[taskIdentifier],
            totalBytesExpectedToWrite > 0
        else {
            return
        }

        if packageProgress[activeDownload.packageID] == nil {
            let package = knownPackages[activeDownload.packageID] ?? persistedPlans[activeDownload.packageID]?.package
            packageProgress[activeDownload.packageID] = PackageProgress(
                totalAssetCount: package?.assets.count ?? 1,
                completedAssetCount: package?.assets.filter {
                    storageService.fileExists($0.filename)
                }.count ?? 0,
                expectedByteCount: package?.estimatedDownloadBytes ?? 0,
                completedByteCount: package.map { completedByteCount(for: $0) } ?? 0
            )
        }
        packageProgress[activeDownload.packageID]?.activeAssetProgress[activeDownload.asset.filename] = ActiveAssetProgress(
            bytesWritten: totalBytesWritten,
            bytesExpected: totalBytesExpectedToWrite
        )
        setPackageStateDownloading(activeDownload.packageID)
    }

    private func finishDownload(taskIdentifier: Int, temporaryURL: URL, response: URLResponse?) {
        guard let activeDownload = activeDownloads[taskIdentifier] else { return }

        guard let httpResponse = response as? HTTPURLResponse else {
            activeDownloads[taskIdentifier] = nil
            retryOrFail(activeDownload, message: "No HTTP response for \(activeDownload.asset.filename).")
            return
        }

        guard 200..<300 ~= httpResponse.statusCode else {
            activeDownloads[taskIdentifier] = nil
            retryOrFail(
                activeDownload,
                message: "HTTP \(httpResponse.statusCode) for \(activeDownload.asset.filename)."
            )
            return
        }

        do {
            try storageService.moveDownloadedFile(from: temporaryURL, toExactFilename: activeDownload.asset.filename)
            packageProgress[activeDownload.packageID]?.completedAssetCount += 1
            packageProgress[activeDownload.packageID]?.completedByteCount += storageService.fileSizeIfExists(
                activeDownload.asset.filename
            )
            packageProgress[activeDownload.packageID]?.activeAssetProgress[activeDownload.asset.filename] = nil
            activeDownloads[taskIdentifier] = nil

            if packageHasActiveOrQueuedWork(activeDownload.packageID) {
                setPackageStateDownloading(activeDownload.packageID)
            } else {
                states[activeDownload.packageID] = .ready
                packageProgress[activeDownload.packageID] = nil
                removePersistedPlan(activeDownload.packageID)
                stopProgressTickerIfIdle()
            }

            pumpQueue()
        } catch {
            activeDownloads[taskIdentifier] = nil
            retryOrFail(activeDownload, message: message(for: error, asset: activeDownload.asset))
        }
    }

    private func completeWithError(taskIdentifier: Int, error: Error?) {
        guard let error, let activeDownload = activeDownloads[taskIdentifier] else { return }
        activeDownloads[taskIdentifier] = nil
        packageProgress[activeDownload.packageID]?.activeAssetProgress[activeDownload.asset.filename] = nil
        retryOrFail(activeDownload, message: message(for: error, asset: activeDownload.asset))
        pumpQueue()
    }

    nonisolated private static func stageDownloadedFile(from location: URL, taskIdentifier: Int) throws -> URL {
        // URLSession removes its download temp file after this delegate callback returns.
        let fileManager = FileManager.default
        let stagingDirectory = fileManager.temporaryDirectory
            .appendingPathComponent("CPRTrainerProDownloads", isDirectory: true)
        try fileManager.createDirectory(at: stagingDirectory, withIntermediateDirectories: true)

        let stagedURL = stagingDirectory
            .appendingPathComponent("\(taskIdentifier)-\(UUID().uuidString)", isDirectory: false)

        if fileManager.fileExists(atPath: stagedURL.path) {
            try fileManager.removeItem(at: stagedURL)
        }

        try fileManager.moveItem(at: location, to: stagedURL)
        return stagedURL
    }

    private func retryOrFail(_ activeDownload: ActiveDownload, message: String) {
        guard activeDownload.attempt < maxRetryAttempts else {
            failPackage(activeDownload.packageID, message: message)
            return
        }

        let nextAttempt = activeDownload.attempt + 1
        let delaySeconds = min(8, pow(2, Double(activeDownload.attempt)))
        states[activeDownload.packageID] = .queued

        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(delaySeconds * 1_000_000_000))
            guard packageProgress[activeDownload.packageID] != nil else { return }

            queue.insert(
                QueuedAsset(
                    packageID: activeDownload.packageID,
                    asset: activeDownload.asset,
                    remoteURL: activeDownload.remoteURL,
                    attempt: nextAttempt
                ),
                at: 0
            )
            pumpQueue()
        }
    }

    private func failPackage(_ packageID: DownloadPackage.ID, message: String) {
        queue.removeAll { $0.packageID == packageID }

        let taskIdentifiers = activeDownloads
            .filter { $0.value.packageID == packageID }
            .map(\.key)

        for taskIdentifier in taskIdentifiers {
            activeDownloads[taskIdentifier] = nil
        }

        session.getAllTasks { tasks in
            for task in tasks where taskIdentifiers.contains(task.taskIdentifier) {
                task.cancel()
            }
        }

        packageProgress[packageID] = nil
        states[packageID] = .failed(message: message)
        removePersistedPlan(packageID)
        stopProgressTickerIfIdle()
    }

    private func packageHasActiveOrQueuedWork(_ packageID: DownloadPackage.ID) -> Bool {
        activeDownloads.values.contains { $0.packageID == packageID }
            || queue.contains { $0.packageID == packageID }
    }

    private func isTrackingDownload(for packageID: DownloadPackage.ID) -> Bool {
        persistedPlans[packageID] != nil
            || packageHasActiveOrQueuedWork(packageID)
            || states[packageID]?.isActiveDownload == true
    }

    private func completedByteCount(for package: DownloadPackage) -> Int64 {
        package.assets.reduce(Int64(0)) { total, asset in
            total + storageService.fileSizeIfExists(asset.filename)
        }
    }

    private func updatePackageProgress(
        package: DownloadPackage?,
        packageID: DownloadPackage.ID,
        totalAssetCount: Int,
        completedAssetCount: Int,
        completedByteCount: Int64,
        activeAssetProgress: [String: ActiveAssetProgress]
    ) {
        var progress = packageProgress[packageID] ?? PackageProgress(
            totalAssetCount: totalAssetCount,
            completedAssetCount: completedAssetCount
        )
        progress.totalAssetCount = totalAssetCount
        progress.completedAssetCount = completedAssetCount
        progress.expectedByteCount = package?.estimatedDownloadBytes ?? progress.expectedByteCount
        progress.completedByteCount = completedByteCount
        progress.activeAssetProgress = activeAssetProgress
        progress.recordSample()
        packageProgress[packageID] = progress
    }

    private func setPackageStateDownloading(_ packageID: DownloadPackage.ID) {
        guard var progress = packageProgress[packageID] else {
            var emptyProgress = PackageProgress(totalAssetCount: 1, completedAssetCount: 0)
            emptyProgress.recordSample()
            packageProgress[packageID] = emptyProgress
            states[packageID] = .downloading(progress: emptyProgress.snapshot)
            startProgressTickerIfNeeded()
            return
        }

        progress.recordSample()
        packageProgress[packageID] = progress
        states[packageID] = .downloading(progress: progress.snapshot)
        startProgressTickerIfNeeded()
    }

    private func remember(_ packages: [DownloadPackage]) {
        for package in packages {
            knownPackages[package.id] = package
        }
    }

    private func trackedPackages() -> [DownloadPackage] {
        var trackedIDs = Set<DownloadPackage.ID>()
        trackedIDs.formUnion(persistedPlans.keys)
        trackedIDs.formUnion(packageProgress.keys)
        trackedIDs.formUnion(queue.map(\.packageID))
        trackedIDs.formUnion(activeDownloads.values.map(\.packageID))
        trackedIDs.formUnion(states.filter { $0.value.isActiveDownload }.map(\.key))

        return trackedIDs.compactMap { id in
            knownPackages[id] ?? persistedPlans[id]?.package
        }
    }

    private func startProgressTickerIfNeeded() {
        guard progressTickerTask == nil, hasTrackedDownloadWork else { return }

        progressTickerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                self?.refreshTrackedDownloadProgress()
            }
        }
    }

    private func stopProgressTickerIfIdle() {
        guard !hasTrackedDownloadWork else { return }
        progressTickerTask?.cancel()
        progressTickerTask = nil
    }

    private var hasTrackedDownloadWork: Bool {
        !queue.isEmpty
            || !activeDownloads.isEmpty
            || !persistedPlans.isEmpty
            || states.values.contains { $0.isActiveDownload }
    }

    private func refreshTrackedDownloadProgress() {
        let packages = trackedPackages()
        guard !packages.isEmpty else {
            stopProgressTickerIfIdle()
            return
        }

        session.getAllTasks { [weak self] tasks in
            Task { @MainActor in
                guard let self else { return }

                self.restore(tasks)
                self.restorePersistedDownloads()
                self.refreshVisiblePackageProgress(for: packages, tasks: tasks)
                self.stopProgressTickerIfIdle()
            }
        }
    }

    private func encodeTaskDescription(_ description: TaskDescription) throws -> String {
        let data = try JSONEncoder().encode(description)
        return String(decoding: data, as: UTF8.self)
    }

    private func decodeTaskDescription(_ description: String) throws -> TaskDescription {
        let data = Data(description.utf8)
        return try JSONDecoder().decode(TaskDescription.self, from: data)
    }

    private func message(for error: Error, asset: MediaAsset) -> String {
        let nsError = error as NSError
        return "\(asset.filename): \(error.localizedDescription) (\(nsError.domain) \(nsError.code))"
    }

    private func loadPersistedPlans() {
        do {
            let plans = try queueStore.load()
            persistedPlans = plans.reduce(into: [:]) { result, plan in
                result[plan.package.id] = plan
            }
            remember(plans.map(\.package))
        } catch {
            persistedPlans = [:]
            assertionFailure("Failed to load persisted download queue: \(error)")
        }
    }

    private func persistPlan(for package: DownloadPackage, baseURL: URL) {
        let plan = DownloadQueueStore.PackagePlan(package: package, baseURL: baseURL)
        persistedPlans[package.id] = plan
        savePersistedPlans()
    }

    private func removePersistedPlan(_ packageID: DownloadPackage.ID) {
        guard persistedPlans.removeValue(forKey: packageID) != nil else { return }
        savePersistedPlans()
    }

    private func savePersistedPlans() {
        do {
            let plans = persistedPlans.values.sorted { $0.package.id.rawValue < $1.package.id.rawValue }
            try queueStore.save(plans)
        } catch {
            assertionFailure("Failed to save persisted download queue: \(error)")
        }
    }

    private static func remoteURL(forExactFilename filename: String, baseURL: URL) -> URL {
        let clean = filename
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "^/+", with: "", options: .regularExpression)

        return clean
            .split(separator: "/", omittingEmptySubsequences: true)
            .reduce(baseURL) { partialURL, component in
                partialURL.appendingPathComponent(String(component), isDirectory: false)
            }
    }
}

extension DownloadService: URLSessionDownloadDelegate {
    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        Task { @MainActor in
            self.handleProgress(
                taskIdentifier: downloadTask.taskIdentifier,
                totalBytesWritten: totalBytesWritten,
                totalBytesExpectedToWrite: totalBytesExpectedToWrite
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
                self.completeWithError(taskIdentifier: downloadTask.taskIdentifier, error: error)
            }
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        Task { @MainActor in
            self.completeWithError(taskIdentifier: task.taskIdentifier, error: error)
        }
    }
}
