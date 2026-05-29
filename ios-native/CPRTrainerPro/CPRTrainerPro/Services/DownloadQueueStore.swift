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

    init(fileManager: FileManager = .default, storeURL: URL? = nil) {
        self.fileManager = fileManager
        self.explicitStoreURL = storeURL
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

    private func resolvedStoreURL() throws -> URL {
        if let explicitStoreURL {
            return explicitStoreURL
        }

        let supportURL = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )

        return supportURL
            .appendingPathComponent("DownloadQueue", isDirectory: true)
            .appendingPathComponent("packages.json", isDirectory: false)
    }

    private func excludeFromBackup(_ url: URL) throws {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutableURL.setResourceValues(values)
    }
}
