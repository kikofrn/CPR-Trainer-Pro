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

    private struct PackageProgress {
        let totalAssetCount: Int
        var completedAssetCount: Int
        var activeFractions: [String: Double] = [:]

        var fractionComplete: Double {
            guard totalAssetCount > 0 else { return 1 }
            let activeTotal = activeFractions.values.reduce(0, +)
            return min(1, Double(completedAssetCount) + activeTotal) / Double(totalAssetCount)
        }
    }

    private struct TaskDescription: Codable {
        let packageID: DownloadPackage.ID
        let asset: MediaAsset
    }

    private let storageService: StorageService
    private let queueStore: DownloadQueueStore
    private let maxConcurrentDownloads = 3
    private let maxRetryAttempts = 3
    private var queue: [QueuedAsset] = []
    private var activeDownloads: [Int: ActiveDownload] = [:]
    private var packageProgress: [DownloadPackage.ID: PackageProgress] = [:]
    private var persistedPlans: [DownloadPackage.ID: DownloadQueueStore.PackagePlan] = [:]

    @Published private var states: [DownloadPackage.ID: DownloadState] = [:]

    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(
            withIdentifier: "com.ehacademy.cpr-trainer-pro.background"
        )
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        configuration.waitsForConnectivity = true
        configuration.httpMaximumConnectionsPerHost = maxConcurrentDownloads
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    init(storageService: StorageService = .init(), queueStore: DownloadQueueStore = .init()) {
        self.storageService = storageService
        self.queueStore = queueStore
        super.init()
        loadPersistedPlans()
        _ = session
        recoverBackgroundTasks()
    }

    func state(for packageID: DownloadPackage.ID) -> DownloadState {
        states[packageID] ?? .notDownloaded
    }

    func refreshPackageStates(for packages: [DownloadPackage]) {
        for package in packages where storageService.packageIsReady(package) {
            states[package.id] = .ready
        }
    }

    func enqueue(_ package: DownloadPackage, baseURL: URL) {
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
        packageProgress[package.id] = PackageProgress(
            totalAssetCount: package.assets.count,
            completedAssetCount: package.assets.count - pendingAssets.count
        )

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
    }

    func delete(_ package: DownloadPackage) {
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
                let task = session.downloadTask(with: next.remoteURL)
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
                failPackage(next.packageID, message: error.localizedDescription)
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
            packageProgress[decoded.packageID] = packageProgress[decoded.packageID] ?? PackageProgress(
                totalAssetCount: 1,
                completedAssetCount: 0
            )
            states[decoded.packageID] = .downloading(progress: 0)
        }
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

            packageProgress[package.id] = PackageProgress(
                totalAssetCount: package.assets.count,
                completedAssetCount: completedAssetCount
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

        let fraction = max(0, min(1, Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)))
        packageProgress[activeDownload.packageID]?.activeFractions[activeDownload.asset.filename] = fraction
        setPackageStateDownloading(activeDownload.packageID)
    }

    private func finishDownload(taskIdentifier: Int, temporaryURL: URL, response: URLResponse?) {
        guard let activeDownload = activeDownloads[taskIdentifier] else { return }

        guard let httpResponse = response as? HTTPURLResponse, 200..<300 ~= httpResponse.statusCode else {
            activeDownloads[taskIdentifier] = nil
            retryOrFail(activeDownload, message: "Server returned an invalid response.")
            return
        }

        do {
            try storageService.moveDownloadedFile(from: temporaryURL, toExactFilename: activeDownload.asset.filename)
            packageProgress[activeDownload.packageID]?.completedAssetCount += 1
            packageProgress[activeDownload.packageID]?.activeFractions[activeDownload.asset.filename] = nil
            activeDownloads[taskIdentifier] = nil

            if packageHasActiveOrQueuedWork(activeDownload.packageID) {
                setPackageStateDownloading(activeDownload.packageID)
            } else {
                states[activeDownload.packageID] = .ready
                packageProgress[activeDownload.packageID] = nil
                removePersistedPlan(activeDownload.packageID)
            }

            pumpQueue()
        } catch {
            activeDownloads[taskIdentifier] = nil
            retryOrFail(activeDownload, message: error.localizedDescription)
        }
    }

    private func completeWithError(taskIdentifier: Int, error: Error?) {
        guard let error, let activeDownload = activeDownloads[taskIdentifier] else { return }
        activeDownloads[taskIdentifier] = nil
        packageProgress[activeDownload.packageID]?.activeFractions[activeDownload.asset.filename] = nil
        retryOrFail(activeDownload, message: error.localizedDescription)
        pumpQueue()
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
    }

    private func packageHasActiveOrQueuedWork(_ packageID: DownloadPackage.ID) -> Bool {
        activeDownloads.values.contains { $0.packageID == packageID }
            || queue.contains { $0.packageID == packageID }
    }

    private func setPackageStateDownloading(_ packageID: DownloadPackage.ID) {
        let progress = packageProgress[packageID]?.fractionComplete ?? 0
        states[packageID] = .downloading(progress: progress)
    }

    private func encodeTaskDescription(_ description: TaskDescription) throws -> String {
        let data = try JSONEncoder().encode(description)
        return String(decoding: data, as: UTF8.self)
    }

    private func decodeTaskDescription(_ description: String) throws -> TaskDescription {
        let data = Data(description.utf8)
        return try JSONDecoder().decode(TaskDescription.self, from: data)
    }

    private func loadPersistedPlans() {
        do {
            let plans = try queueStore.load()
            persistedPlans = plans.reduce(into: [:]) { result, plan in
                result[plan.package.id] = plan
            }
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
        Task { @MainActor in
            self.finishDownload(
                taskIdentifier: downloadTask.taskIdentifier,
                temporaryURL: location,
                response: downloadTask.response
            )
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
