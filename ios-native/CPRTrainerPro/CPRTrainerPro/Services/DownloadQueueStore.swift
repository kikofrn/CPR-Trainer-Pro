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

    @discardableResult
    func migrateObsoleteFilenames(using catalog: TrainingCatalog) throws -> Bool {
        let plans = try load()
        let migrated = plans.map { plan in
            PackagePlan(
                package: ContentFilenameAliases.canonicalPackage(
                    plan.package,
                    catalog: catalog
                ),
                baseURL: plan.baseURL
            )
        }
        guard migrated != plans else { return false }
        try save(migrated)
        return true
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

struct DownloadAllQueueStore {
    struct Plan: Codable, Equatable {
        var packageIDs: [DownloadPackage.ID]
        let baseURL: URL
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
        return try JSONDecoder().decode(StorePayload.self, from: data).plan
    }

    func save(_ plan: Plan) throws {
        let url = try resolvedStoreURL()
        try fileManager.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        let payload = StorePayload(schemaVersion: 1, plan: plan)
        let data = try JSONEncoder().encode(payload)
        try data.write(to: url, options: [.atomic])
        try excludeFromBackup(url)
    }

    @discardableResult
    func migrateObsoletePackageIDs(using catalog: TrainingCatalog) throws -> Bool {
        guard var plan = try load() else { return false }
        let validPackageIDs = Set(catalog.packages.map(\.id))
        var seen = Set<DownloadPackage.ID>()
        let migratedPackageIDs = plan.packageIDs.filter {
            validPackageIDs.contains($0) && seen.insert($0).inserted
        }
        guard migratedPackageIDs != plan.packageIDs else { return false }

        plan.packageIDs = migratedPackageIDs
        if plan.packageIDs.isEmpty {
            try remove()
        } else {
            try save(plan)
        }
        return true
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

        return try applicationSupportDirectory()
            .appendingPathComponent("DownloadQueue-\(sanitizedRevision)", isDirectory: true)
            .appendingPathComponent("download-all.json", isDirectory: false)
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
