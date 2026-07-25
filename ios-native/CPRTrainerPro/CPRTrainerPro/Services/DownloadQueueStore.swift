import Foundation

struct DownloadQueueStore {
    struct PackagePlan: Codable, Equatable {
        let package: DownloadPackage
        let baseURL: URL
    }

    enum StoreError: LocalizedError {
        case unavailable

        var errorDescription: String? {
            switch self {
            case .unavailable:
                "Download queue storage is unavailable."
            }
        }
    }

    private struct StorePayload: Codable {
        let schemaVersion: Int
        var plans: [PackagePlan]
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

    func load() throws -> [PackagePlan] {
        let url = try resolvedStoreURL()
        guard fileManager.fileExists(atPath: url.path) else { return [] }

        let data = try Data(contentsOf: url)
        let payload = try JSONDecoder().decode(StorePayload.self, from: data)
        return payload.plans
    }

    func save(_ plans: [PackagePlan]) throws {
        let url = try resolvedStoreURL()
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)

        let payload = StorePayload(schemaVersion: 1, plans: plans)
        let data = try JSONEncoder().encode(payload)
        try data.write(to: url, options: [.atomic])
        try excludeFromBackup(url)
    }

    func upsert(_ plan: PackagePlan) throws {
        var plans = try load()
        plans.removeAll { $0.package.id == plan.package.id }
        plans.append(plan)
        try save(plans)
    }

    func remove(packageID: DownloadPackage.ID) throws {
        var plans = try load()
        plans.removeAll { $0.package.id == packageID }
        try save(plans)
    }

    func removeLegacyStore() throws {
        let legacyRoot = try applicationSupportDirectory()
            .appendingPathComponent("DownloadQueue", isDirectory: true)

        guard fileManager.fileExists(atPath: legacyRoot.path) else { return }
        try fileManager.removeItem(at: legacyRoot)
    }

    private func resolvedStoreURL() throws -> URL {
        if let explicitStoreURL {
            return explicitStoreURL
        }

        return try applicationSupportDirectory()
            .appendingPathComponent("DownloadQueue-\(sanitizedRevision)", isDirectory: true)
            .appendingPathComponent("packages.json", isDirectory: false)
    }

    private var sanitizedRevision: String {
        let sanitized = contentRevision.replacingOccurrences(
            of: "[^A-Za-z0-9._-]",
            with: "-",
            options: .regularExpression
        )
        return sanitized.isEmpty ? "current" : sanitized
    }

    private func applicationSupportDirectory() throws -> URL {
        if let explicitSupportDirectoryURL {
            try fileManager.createDirectory(
                at: explicitSupportDirectoryURL,
                withIntermediateDirectories: true
            )
            return explicitSupportDirectoryURL
        }

        return try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
    }

    private func excludeFromBackup(_ url: URL) throws {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutableURL.setResourceValues(values)
    }
}
