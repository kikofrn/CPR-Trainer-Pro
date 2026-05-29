import Foundation

struct StorageService {
    enum StorageError: LocalizedError {
        case unsafeFilename(String)
        case emptyDownloadedFile(String)

        var errorDescription: String? {
            switch self {
            case .unsafeFilename(let filename):
                "Unsafe media filename: \(filename)"
            case .emptyDownloadedFile(let filename):
                "Downloaded file was empty: \(filename)"
            }
        }
    }

    private let fileManager: FileManager

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    var downloadedMediaRoot: URL {
        get throws {
            let supportURL = try fileManager.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )

            let root = supportURL.appendingPathComponent("DownloadedMedia", isDirectory: true)
            try ensureDirectory(root)
            try excludeFromBackup(root)
            return root
        }
    }

    func fileExists(_ filename: String) -> Bool {
        if (try? bundledResourceURL(for: filename)) != nil {
            return true
        }

        guard let url = try? localURL(for: filename) else { return false }
        return fileManager.fileExists(atPath: url.path)
    }

    func localURL(for filename: String) throws -> URL {
        if let bundledURL = try bundledResourceURL(for: filename) {
            return bundledURL
        }

        let clean = try sanitizedRelativePath(filename)
        return try downloadedMediaRoot.appendingPathComponent(clean, isDirectory: false)
    }

    func prepareParentDirectory(for filename: String) throws {
        let parent = try localURL(for: filename).deletingLastPathComponent()
        try ensureDirectory(parent)
    }

    func moveDownloadedFile(from temporaryURL: URL, toExactFilename filename: String) throws {
        let destinationURL = try localURL(for: filename)
        try ensureDirectory(destinationURL.deletingLastPathComponent())

        let byteCount = (try? temporaryURL.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard byteCount > 0 else {
            throw StorageError.emptyDownloadedFile(filename)
        }

        if fileManager.fileExists(atPath: destinationURL.path) {
            try fileManager.removeItem(at: destinationURL)
        }

        try fileManager.moveItem(at: temporaryURL, to: destinationURL)
        try excludeFromBackup(destinationURL)
        try setClassCFileProtection(destinationURL)
    }

    func deletePackage(_ package: DownloadPackage) throws {
        for asset in package.assets {
            if (try? bundledResourceURL(for: asset.filename)) != nil {
                continue
            }

            let url = try localURL(for: asset.filename)
            if fileManager.fileExists(atPath: url.path) {
                try fileManager.removeItem(at: url)
            }
        }
    }

    func packageIsReady(_ package: DownloadPackage) -> Bool {
        package.assets.allSatisfy { fileExists($0.filename) }
    }

    func availableDiskBytes() -> Int64? {
        guard let root = try? downloadedMediaRoot else { return nil }
        let values = try? root.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        return values?.volumeAvailableCapacityForImportantUsage
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
        guard clean.hasPrefix("subtitles/") else { return nil }

        let subtitleName = String(clean.dropFirst("subtitles/".count))
        return Bundle.main.url(forResource: subtitleName, withExtension: nil, subdirectory: "Subtitles")
    }

    private func ensureDirectory(_ url: URL) throws {
        try fileManager.createDirectory(at: url, withIntermediateDirectories: true)
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
