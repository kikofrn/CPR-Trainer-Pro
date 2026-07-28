import Foundation

struct StorageService {
    enum StorageError: LocalizedError {
        case unsafeFilename(String)
        case emptyDownloadedFile(String)
        case unexpectedFileSize(filename: String, expected: Int64, actual: Int64)

        var errorDescription: String? {
            switch self {
            case .unsafeFilename(let filename):
                "Unsafe media filename: \(filename)"
            case .emptyDownloadedFile(let filename):
                "Downloaded file was empty: \(filename)"
            case .unexpectedFileSize(let filename, let expected, let actual):
                "Downloaded file size did not match \(filename) (expected \(expected) bytes, received \(actual))."
            }
        }
    }

    private let fileManager: FileManager
    private let contentRevision: String
    private let explicitSupportDirectoryURL: URL?
    private let versionStore: ContentVersionStore?

    init(
        fileManager: FileManager = .default,
        contentRevision: String = "experiment-3.0",
        supportDirectoryURL: URL? = nil,
        versionStore: ContentVersionStore? = nil
    ) {
        self.fileManager = fileManager
        self.contentRevision = contentRevision
        self.explicitSupportDirectoryURL = supportDirectoryURL
        self.versionStore = versionStore
    }

    var downloadedMediaRoot: URL {
        get throws {
            let supportURL = try applicationSupportDirectory()
            let root = supportURL.appendingPathComponent(
                "DownloadedMedia-\(sanitizedRevision)",
                isDirectory: true
            )
            try ensureDirectory(root)
            try excludeFromBackup(root)
            return root
        }
    }

    func removeLegacyDownloadedMedia() throws {
        let legacyRoot = try applicationSupportDirectory()
            .appendingPathComponent("DownloadedMedia", isDirectory: true)

        guard fileManager.fileExists(atPath: legacyRoot.path) else { return }
        try fileManager.removeItem(at: legacyRoot)
    }

    func fileExists(_ filename: String) -> Bool {
        if (try? bundledResourceURL(for: filename)) != nil {
            return true
        }

        guard let url = try? downloadDestinationURL(for: filename) else { return false }
        return fileManager.fileExists(atPath: url.path)
    }

    func fileExists(_ asset: MediaAsset) -> Bool {
        guard
            let url = try? playbackURL(for: asset.filename),
            fileManager.fileExists(atPath: url.path),
            let byteCount = try? fileSize(at: url),
            byteCount > 0
        else {
            return false
        }

        let expectedByteCount = versionStore?
            .installedVersion(for: asset.filename)?
            .byteCount ?? asset.byteCount
        guard let expectedByteCount, expectedByteCount > 0 else {
            return true
        }

        return byteCount == UInt64(expectedByteCount)
    }

    func localURL(for filename: String) throws -> URL {
        try playbackURL(for: filename)
    }

    func playbackURL(for filename: String) throws -> URL {
        let downloadedURL = try downloadDestinationURL(for: filename)
        if fileManager.fileExists(atPath: downloadedURL.path) {
            return downloadedURL
        }
        if let bundledURL = try bundledResourceURL(for: filename) {
            return bundledURL
        }

        return downloadedURL
    }

    func downloadDestinationURL(for filename: String) throws -> URL {
        try downloadedURL(for: filename)
    }

    func hasDownloadedCopy(_ filename: String) -> Bool {
        guard let url = try? downloadDestinationURL(for: filename) else { return false }
        return fileManager.fileExists(atPath: url.path)
    }

    func hasPlayableCopy(_ filename: String) -> Bool {
        guard let url = try? playbackURL(for: filename) else { return false }
        return fileManager.fileExists(atPath: url.path)
    }

    func prepareParentDirectory(for filename: String) throws {
        let parent = try downloadDestinationURL(for: filename).deletingLastPathComponent()
        try ensureDirectory(parent)
    }

    func moveDownloadedFile(
        from temporaryURL: URL,
        for asset: MediaAsset,
        expectedByteCount: Int64? = nil
    ) throws {
        let destinationURL = try downloadDestinationURL(for: asset.filename)
        try ensureDirectory(destinationURL.deletingLastPathComponent())

        let byteCount = try fileSize(at: temporaryURL)
        guard byteCount > 0 else {
            throw StorageError.emptyDownloadedFile(asset.filename)
        }

        let validatedByteCount = expectedByteCount ?? asset.byteCount
        if let validatedByteCount, validatedByteCount > 0,
           byteCount != UInt64(validatedByteCount) {
            throw StorageError.unexpectedFileSize(
                filename: asset.filename,
                expected: validatedByteCount,
                actual: Int64(byteCount)
            )
        }

        let incomingURL = destinationURL
            .deletingLastPathComponent()
            .appendingPathComponent(
                ".\(destinationURL.lastPathComponent).incoming-\(UUID().uuidString)",
                isDirectory: false
            )
        try fileManager.moveItem(at: temporaryURL, to: incomingURL)

        if fileManager.fileExists(atPath: destinationURL.path) {
            do {
                _ = try fileManager.replaceItemAt(
                    destinationURL,
                    withItemAt: incomingURL,
                    backupItemName: nil,
                    options: []
                )
            } catch {
                if fileManager.fileExists(atPath: incomingURL.path) {
                    try? fileManager.removeItem(at: incomingURL)
                }
                throw error
            }
        } else {
            try fileManager.moveItem(at: incomingURL, to: destinationURL)
        }

        try excludeFromBackup(destinationURL)
        try setClassCFileProtection(destinationURL)
    }

    func deletePackage(_ package: DownloadPackage) throws {
        for asset in package.assets {
            if (try? bundledResourceURL(for: asset.filename)) != nil {
                continue
            }

            let url = try downloadDestinationURL(for: asset.filename)
            if fileManager.fileExists(atPath: url.path) {
                try fileManager.removeItem(at: url)
            }
        }
    }

    func packageIsReady(_ package: DownloadPackage) -> Bool {
        package.assets.allSatisfy(fileExists)
    }

    func fileSizeIfExists(_ filename: String) -> Int64 {
        guard
            let url = try? playbackURL(for: filename),
            fileManager.fileExists(atPath: url.path),
            let attributes = try? fileManager.attributesOfItem(atPath: url.path),
            let size = attributes[.size] as? NSNumber
        else {
            return 0
        }

        return size.int64Value
    }

    func downloadedPackageByteCount(_ package: DownloadPackage) -> Int64 {
        package.assets.reduce(Int64(0)) { total, asset in
            total + downloadedFileSizeIfExists(asset.filename)
        }
    }

    func availableDiskBytes() -> Int64? {
        guard let root = try? downloadedMediaRoot else { return nil }
        let values = try? root.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        return values?.volumeAvailableCapacityForImportantUsage
    }

    private func downloadedFileSizeIfExists(_ filename: String) -> Int64 {
        guard (try? bundledResourceURL(for: filename)) == nil else { return 0 }
        guard
            let url = try? downloadedURL(for: filename),
            fileManager.fileExists(atPath: url.path),
            let attributes = try? fileManager.attributesOfItem(atPath: url.path),
            let size = attributes[.size] as? NSNumber
        else {
            return 0
        }

        return size.int64Value
    }

    private func downloadedURL(for filename: String) throws -> URL {
        let clean = try sanitizedRelativePath(filename)
        return try downloadedMediaRoot.appendingPathComponent(clean, isDirectory: false)
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
            try ensureDirectory(explicitSupportDirectoryURL)
            return explicitSupportDirectoryURL
        }

        return try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
    }

    private func sanitizedRelativePath(_ filename: String) throws -> String {
        let clean = filename
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "^/+", with: "", options: .regularExpression)

        let parts = clean.split(separator: "/", omittingEmptySubsequences: true)
        guard !parts.isEmpty, !parts.contains("..") else {
            throw StorageError.unsafeFilename(filename)
        }

        return parts.map(String.init).joined(separator: "/")
    }

    private func bundledResourceURL(for filename: String) throws -> URL? {
        let clean = try sanitizedRelativePath(filename)
        guard clean.lowercased().hasPrefix("subtitles/") else { return nil }

        let subtitleName = String(clean.dropFirst("subtitles/".count))
        return Bundle.main.url(forResource: subtitleName, withExtension: nil, subdirectory: "Subtitles")
    }

    private func ensureDirectory(_ url: URL) throws {
        try fileManager.createDirectory(at: url, withIntermediateDirectories: true)
    }

    private func fileSize(at url: URL) throws -> UInt64 {
        let attributes = try fileManager.attributesOfItem(atPath: url.path)
        guard let size = attributes[.size] as? NSNumber else { return 0 }
        return size.uint64Value
    }

    private func excludeFromBackup(_ url: URL) throws {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutableURL.setResourceValues(values)
    }

    private func setClassCFileProtection(_ url: URL) throws {
        #if os(iOS)
        try fileManager.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: url.path
        )
        #endif
    }
}

struct ContentStateMigrator {
    struct Alias: Equatable {
        let oldFilename: String
        let newFilename: String
    }

    static let aliases = [
        Alias(
            oldFilename: "CPR AED Presentation Slides/14_EHAcademy - CPR AED Course Pres--Getting Help.png",
            newFilename: "CPR AED Presentation Slides/14_EHAcademy - CPR AED Course Pres-Getting Help.png"
        ),
        Alias(
            oldFilename: "Pedi First Aid Presentation Slides/07_EHAcademy - Pedi FA Course Pres- MEDICAL EMERGENCIES.png",
            newFilename: "Pedi First Aid Presentation Slides/07_EHAcademy - Pedi FA Course Pres-MEDICAL EMERGENCIES.png"
        )
    ]

    private let fileManager: FileManager
    private let storageService: StorageService
    private let versionStore: ContentVersionStore

    init(
        fileManager: FileManager = .default,
        storageService: StorageService,
        versionStore: ContentVersionStore
    ) {
        self.fileManager = fileManager
        self.storageService = storageService
        self.versionStore = versionStore
    }

    @discardableResult
    func migrate(using catalog: TrainingCatalog) -> Set<String> {
        let assetsByFilename = Dictionary(
            catalog.packages.flatMap(\.assets).map { ($0.filename, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        var migrated: Set<String> = []

        for alias in Self.aliases {
            guard
                let correctedAsset = assetsByFilename[alias.newFilename],
                let correctedVersion = RemoteAssetVersion(asset: correctedAsset),
                let oldRecord = versionStore.record(for: alias.oldFilename),
                oldRecord.version.matches(correctedVersion),
                let oldURL = try? storageService.downloadDestinationURL(for: alias.oldFilename),
                let newURL = try? storageService.downloadDestinationURL(for: alias.newFilename),
                fileManager.fileExists(atPath: oldURL.path),
                let attributes = try? fileManager.attributesOfItem(atPath: oldURL.path),
                let onDiskSize = attributes[.size] as? NSNumber,
                onDiskSize.int64Value == correctedVersion.byteCount
            else {
                continue
            }

            do {
                try fileManager.createDirectory(
                    at: newURL.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                if fileManager.fileExists(atPath: newURL.path) {
                    let newAttributes = try fileManager.attributesOfItem(atPath: newURL.path)
                    let newSize = (newAttributes[.size] as? NSNumber)?.int64Value
                    guard newSize == correctedVersion.byteCount else { continue }
                    try fileManager.removeItem(at: oldURL)
                } else {
                    try fileManager.moveItem(at: oldURL, to: newURL)
                }
                try versionStore.migrateRecord(
                    from: alias.oldFilename,
                    to: alias.newFilename
                )
                migrated.insert(alias.newFilename)
            } catch {
                // The operation is intentionally idempotent. Leave either valid copy and
                // retry on the next launch rather than deleting the last playable file.
            }
        }

        return migrated
    }
}
