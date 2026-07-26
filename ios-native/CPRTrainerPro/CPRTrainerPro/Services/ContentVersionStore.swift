import Foundation

final class ContentVersionStore: @unchecked Sendable {
    struct Record: Codable, Equatable {
        let filename: String
        var version: RemoteAssetVersion
        var installedAt: Date
        var lastCheckedAt: Date?
    }

    private struct StorePayload: Codable {
        let schemaVersion: Int
        var records: [String: Record]
    }

    private let fileManager: FileManager
    private let explicitStoreURL: URL?
    private let contentRevision: String
    private let explicitSupportDirectoryURL: URL?
    private let lock = NSLock()
    private var records: [String: Record]

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

        if let storeURL = try? Self.resolvedStoreURL(
            fileManager: fileManager,
            explicitStoreURL: storeURL,
            contentRevision: contentRevision,
            explicitSupportDirectoryURL: supportDirectoryURL
        ),
           fileManager.fileExists(atPath: storeURL.path),
           let data = try? Data(contentsOf: storeURL),
           let payload = try? JSONDecoder().decode(StorePayload.self, from: data),
           payload.schemaVersion == 1 {
            self.records = payload.records
        } else {
            self.records = [:]
        }
    }

    func record(for filename: String) -> Record? {
        lock.lock()
        defer { lock.unlock() }
        return records[filename]
    }

    func installedVersion(for filename: String) -> RemoteAssetVersion? {
        record(for: filename)?.version
    }

    func adoptBundledVersionsIfNeeded(_ assets: [MediaAsset], now: Date = Date()) throws {
        lock.lock()
        defer { lock.unlock() }

        var changed = false
        for asset in assets {
            guard records[asset.filename] == nil,
                  let version = RemoteAssetVersion(asset: asset)
            else {
                continue
            }

            records[asset.filename] = Record(
                filename: asset.filename,
                version: version,
                installedAt: now,
                lastCheckedAt: nil
            )
            changed = true
        }

        if changed {
            try saveLocked()
        }
    }

    func recordInstalled(
        filename: String,
        version: RemoteAssetVersion,
        installedAt: Date = Date()
    ) throws {
        lock.lock()
        defer { lock.unlock() }

        records[filename] = Record(
            filename: filename,
            version: version,
            installedAt: installedAt,
            lastCheckedAt: installedAt
        )
        try saveLocked()
    }

    func markChecked(filename: String, at date: Date = Date()) throws {
        try markChecked(filenames: [filename], at: date)
    }

    func markChecked(filenames: [String], at date: Date = Date()) throws {
        lock.lock()
        defer { lock.unlock() }

        var changed = false
        for filename in filenames {
            guard var record = records[filename] else { continue }
            record.lastCheckedAt = date
            records[filename] = record
            changed = true
        }
        guard changed else { return }
        try saveLocked()
    }

    private func saveLocked() throws {
        let url = try Self.resolvedStoreURL(
            fileManager: fileManager,
            explicitStoreURL: explicitStoreURL,
            contentRevision: contentRevision,
            explicitSupportDirectoryURL: explicitSupportDirectoryURL
        )
        try fileManager.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        let payload = StorePayload(schemaVersion: 1, records: records)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(payload)
        try data.write(to: url, options: [.atomic])
        try Self.excludeFromBackup(url)
    }

    private static func resolvedStoreURL(
        fileManager: FileManager,
        explicitStoreURL: URL?,
        contentRevision: String,
        explicitSupportDirectoryURL: URL?
    ) throws -> URL {
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
            .appendingPathComponent("ContentVersions-\(revision)", isDirectory: true)
            .appendingPathComponent("installed-assets.json", isDirectory: false)
    }

    private static func excludeFromBackup(_ url: URL) throws {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutableURL.setResourceValues(values)
    }
}
