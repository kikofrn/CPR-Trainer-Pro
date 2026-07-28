import Foundation

struct TrainingCatalog: Codable, Equatable {
    let schemaVersion: Int
    let contentRevision: String
    let mediaBaseURL: URL
    let sendCertsURL: URL
    var courses: [Course]
    var videoCourses: [VideoCourse]
    var slideshows: [Slideshow]
    var manuals: [Manual]
    var packages: [DownloadPackage]
}

struct Course: Identifiable, Codable, Equatable {
    enum ID: String, Codable, Hashable {
        case cprAED = "cpr-aed"
        case firstAid = "first-aid"
    }

    let id: ID
    let title: String
    let subtitle: String
    let artworkName: String
    let modes: [CourseLaunchMode]
}

struct CourseLaunchMode: Identifiable, Codable, Equatable {
    enum ID: String, Codable, Hashable {
        case cprSlideshow = "cpr-aed-course"
        case cprVideo = "cpr-aed"
        case pediatricCPRSlideshow = "pediatric-cpr-aed-course"
        case pediatricCPRVideo = "pediatric-cpr-aed"
        case firstAidSlideshow = "first-aid-course"
        case firstAidVideo = "first-aid"
        case pediatricSlideshow = "pediatric-first-aid-course"
        case pediatricFirstAidVideo = "pediatric-first-aid"
    }

    enum Kind: String, Codable, Equatable {
        case slideshow
        case video
    }

    let id: ID
    let kind: Kind
    let title: String
    let packageID: DownloadPackage.ID?
    let isAvailable: Bool

    init(
        id: ID,
        kind: Kind,
        title: String,
        packageID: DownloadPackage.ID?,
        isAvailable: Bool = true
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.packageID = packageID
        self.isAvailable = isAvailable
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case kind
        case title
        case packageID
        case isAvailable
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try values.decode(ID.self, forKey: .id),
            kind: try values.decode(Kind.self, forKey: .kind),
            title: try values.decode(String.self, forKey: .title),
            packageID: try values.decodeIfPresent(
                DownloadPackage.ID.self,
                forKey: .packageID
            ),
            isAvailable: try values.decodeIfPresent(
                Bool.self,
                forKey: .isAvailable
            ) ?? true
        )
    }
}

struct VideoCourse: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let shortTitle: String
    let manualFilename: String
    let chapters: [Chapter]
}

struct Chapter: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let filename: String
    let duration: String?
    let subtitle: String?
    let description: String?
    let isSectionHeader: Bool
    let parentSectionId: String?
}

struct Slideshow: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let slides: [Slide]
}

struct Slide: Identifiable, Codable, Equatable {
    enum MediaType: String, Codable {
        case image
        case video
    }

    let id: String
    let title: String
    let filename: String
    let type: MediaType
    let isSectionHeader: Bool
    let parentSectionId: String?
}

struct Manual: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let description: String
    let filename: String
    let thumbnail: String
    let packageID: DownloadPackage.ID
}

struct MediaAsset: Identifiable, Codable, Equatable {
    enum Kind: String, Codable {
        case video
        case image
        case pdf
        case subtitle
    }

    let id: String
    let filename: String
    let kind: Kind
    let byteCount: Int64?
    let eTag: String?
    let lastModified: String?

    init(
        id: String,
        filename: String,
        kind: Kind,
        byteCount: Int64?,
        eTag: String? = nil,
        lastModified: String? = nil
    ) {
        self.id = id
        self.filename = filename
        self.kind = kind
        self.byteCount = byteCount
        self.eTag = eTag
        self.lastModified = lastModified
    }

    var isRequiredForLaunch: Bool {
        kind != .subtitle
    }

    func replacingRemoteVersion(_ version: RemoteAssetVersion) -> MediaAsset {
        return MediaAsset(
            id: id,
            filename: filename,
            kind: kind,
            byteCount: version.byteCount,
            eTag: version.eTag,
            lastModified: version.lastModified
        )
    }
}

struct DownloadPackage: Identifiable, Codable, Equatable {
    enum ID: String, Codable, Hashable {
        case cprSlideshow = "package.cpr-aed.slideshow"
        case cprVideo = "package.cpr-aed.video"
        case pediatricCPRSlideshow = "package.cpr-aed.pediatric-slideshow"
        case firstAidSlideshow = "package.first-aid.slideshow"
        case firstAidVideo = "package.first-aid.video"
        case pediatricSlideshow = "package.first-aid.pediatric-slideshow"
        case instructorManual = "package.manual.instructor"
        case studentManual = "package.manual.student"
        case pediatricManual = "package.manual.pediatric"
    }

    let id: ID
    let title: String
    let assets: [MediaAsset]

    var requiredAssets: [MediaAsset] {
        assets.filter(\.isRequiredForLaunch)
    }

    func replacingAssets(_ assets: [MediaAsset]) -> DownloadPackage {
        DownloadPackage(id: id, title: title, assets: assets)
    }
}

struct DownloadContentEstimate: Equatable {
    static let typicalConnectionMegabitsPerSecond = 25.0

    let remainingByteCount: Int64
    let remainingAssetCount: Int

    var sizeText: String {
        ByteCountFormatter.string(fromByteCount: remainingByteCount, countStyle: .file)
    }

    var estimatedDurationSeconds: TimeInterval {
        let bits = Double(max(0, remainingByteCount)) * 8
        let bitsPerSecond = Self.typicalConnectionMegabitsPerSecond * 1_000_000
        return bits / bitsPerSecond
    }

    var durationText: String {
        let totalMinutes = max(1, Int(ceil(estimatedDurationSeconds / 60)))

        if totalMinutes < 60 {
            return "about \(totalMinutes) min on a typical 25 Mbps connection"
        }

        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60
        if minutes == 0 {
            return "about \(hours) hr on a typical 25 Mbps connection"
        }

        return "about \(hours) hr \(minutes) min on a typical 25 Mbps connection"
    }
}

struct TransferNetworkPolicySnapshot: Equatable {
    let isKnown: Bool
    let isSatisfied: Bool
    let isExpensive: Bool
    let allowsCellular: Bool

    var isConfirmedWiFi: Bool {
        isKnown && isSatisfied && !isExpensive
    }

    var allowsTransfers: Bool {
        guard isKnown else { return true }
        return isSatisfied && (!isExpensive || allowsCellular)
    }
}

struct RemoteAssetVersion: Codable, Equatable, Sendable {
    let byteCount: Int64
    let eTag: String?
    let lastModified: String?

    init(byteCount: Int64, eTag: String?, lastModified: String?) {
        self.byteCount = byteCount
        self.eTag = Self.canonicalETag(eTag)
        self.lastModified = Self.normalizedHeader(lastModified)
    }

    private enum CodingKeys: String, CodingKey {
        case byteCount
        case eTag
        case lastModified
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            byteCount: try values.decode(Int64.self, forKey: .byteCount),
            eTag: try values.decodeIfPresent(String.self, forKey: .eTag),
            lastModified: try values.decodeIfPresent(String.self, forKey: .lastModified)
        )
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(byteCount, forKey: .byteCount)
        try values.encodeIfPresent(eTag, forKey: .eTag)
        try values.encodeIfPresent(lastModified, forKey: .lastModified)
    }

    init?(asset: MediaAsset) {
        guard let byteCount = asset.byteCount, byteCount > 0 else { return nil }
        self.init(
            byteCount: byteCount,
            eTag: asset.eTag,
            lastModified: asset.lastModified
        )
    }

    init?(response: HTTPURLResponse) {
        let contentRange = response.value(forHTTPHeaderField: "Content-Range")
        let rangeTotal = contentRange?
            .split(separator: "/")
            .last
            .flatMap { Int64($0) }
        let headerByteCount = response.value(forHTTPHeaderField: "Content-Length")
            .flatMap(Int64.init)
        let byteCount = rangeTotal ?? headerByteCount ?? response.expectedContentLength
        guard byteCount > 0 else { return nil }

        self.init(
            byteCount: byteCount,
            eTag: response.value(forHTTPHeaderField: "ETag"),
            lastModified: response.value(forHTTPHeaderField: "Last-Modified")
        )
    }

    func representsUpdate(comparedTo installed: RemoteAssetVersion) -> Bool {
        if byteCount > 0, installed.byteCount > 0, byteCount != installed.byteCount {
            return true
        }

        if let eTag, let installedETag = installed.eTag {
            return eTag != installedETag
        }

        if
            installed.eTag == nil,
            let remoteDate = Self.parsedDate(lastModified),
            let installedDate = Self.parsedDate(installed.lastModified),
            remoteDate.timeIntervalSince(installedDate) > 10 * 60
        {
            return true
        }

        return false
    }

    func matches(_ other: RemoteAssetVersion) -> Bool {
        guard byteCount == other.byteCount else { return false }
        if let eTag, let otherETag = other.eTag {
            return otherETag == eTag
        }
        return eTag == nil
    }

    static func canonicalETag(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty
        else {
            return nil
        }

        var canonical = trimmed
        if canonical.lowercased().hasPrefix("w/") {
            canonical.removeFirst(2)
            canonical = canonical.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if canonical.count >= 2,
           canonical.first == "\"",
           canonical.last == "\"" {
            canonical.removeFirst()
            canonical.removeLast()
        }
        canonical = canonical.trimmingCharacters(in: .whitespacesAndNewlines)
        return canonical.isEmpty ? nil : canonical
    }

    private static func normalizedHeader(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty
        else {
            return nil
        }
        return trimmed
    }

    private static func parsedDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractionalFormatter.date(from: value)
            ?? ISO8601DateFormatter().date(from: value)
            ?? HTTPDateParser.date(from: value)
    }
}

struct ContentUpdateCandidate: Identifiable, Codable, Equatable {
    let asset: MediaAsset
    let remoteVersion: RemoteAssetVersion

    var id: String {
        asset.filename
    }
}

struct ContentUpdateSummary: Identifiable, Equatable {
    let candidates: [ContentUpdateCandidate]

    var id: String {
        fingerprint
    }

    var fingerprint: String {
        candidates
            .map { candidate in
                [
                    candidate.asset.filename,
                    candidate.remoteVersion.eTag ?? "no-etag",
                    String(candidate.remoteVersion.byteCount)
                ]
                .joined(separator: "#")
            }
            .sorted()
            .joined(separator: "|")
    }

    var assetCount: Int {
        candidates.count
    }

    var totalByteCount: Int64 {
        candidates.reduce(Int64(0)) { total, candidate in
            total + candidate.remoteVersion.byteCount
        }
    }

    var sizeText: String {
        ByteCountFormatter.string(fromByteCount: totalByteCount, countStyle: .file)
    }

    var durationText: String {
        let bytesPerSecond = 25_000_000.0 / 8.0
        let seconds = min(86_400, max(15, Double(totalByteCount) / bytesPerSecond))
        if seconds < 60 {
            return "less than 1 min"
        }
        let minutes = max(1, Int((seconds / 60).rounded(.up)))
        if minutes < 60 {
            return "about \(minutes) min"
        }
        let hours = minutes / 60
        let remainder = minutes % 60
        return remainder == 0
            ? "about \(hours) hr"
            : "about \(hours) hr \(remainder) min"
    }
}

private enum HTTPDateParser {
    private static let lock = NSLock()
    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE',' dd MMM yyyy HH':'mm':'ss 'GMT'"
        return formatter
    }()

    static func date(from value: String) -> Date? {
        lock.lock()
        defer { lock.unlock() }
        return formatter.date(from: value)
    }
}

struct DownloadProgressSnapshot: Equatable {
    let fractionComplete: Double
    let completedAssetCount: Int
    let totalAssetCount: Int
    let activeAssetCount: Int
    let etaSeconds: TimeInterval?

    var percent: Int {
        Int((fractionComplete * 100).rounded())
    }

    var percentText: String {
        "\(percent)%"
    }

    var etaText: String? {
        guard let etaSeconds, etaSeconds.isFinite, etaSeconds > 0 else { return nil }

        if etaSeconds < 60 {
            return "less than 1 min left"
        }

        let totalMinutes = max(1, Int((etaSeconds / 60).rounded()))
        if totalMinutes < 60 {
            return "\(totalMinutes) min left"
        }

        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60
        if minutes == 0 {
            return "\(hours) hr left"
        }

        return "\(hours) hr \(minutes) min left"
    }

    var fileCountText: String {
        "\(completedAssetCount) of \(totalAssetCount) files"
    }
}

enum DownloadState: Equatable {
    case notDownloaded
    case queued
    case waitingForWiFi
    case downloading(progress: DownloadProgressSnapshot)
    case ready
    case failed(message: String)

    var isReady: Bool {
        if case .ready = self { return true }
        return false
    }

    var isActiveDownload: Bool {
        switch self {
        case .queued, .waitingForWiFi, .downloading:
            true
        default:
            false
        }
    }

    var progressFraction: Double? {
        progressSnapshot?.fractionComplete
    }

    var progressSnapshot: DownloadProgressSnapshot? {
        if case .downloading(let progress) = self {
            return progress
        }

        return nil
    }
}

extension DownloadPackage {
    var estimatedDownloadBytes: Int64 {
        let declaredByteCount = assets.reduce(Int64(0)) { total, asset in
            total + asset.estimatedByteCount
        }
        if declaredByteCount > 0 {
            return declaredByteCount
        }

        switch id {
        case .cprSlideshow:
            return 700_000_000
        case .cprVideo:
            return 900_000_000
        case .pediatricCPRSlideshow:
            return 700_000_000
        case .firstAidSlideshow:
            return 750_000_000
        case .firstAidVideo:
            return 1_400_000_000
        case .pediatricSlideshow:
            return 750_000_000
        case .instructorManual, .studentManual, .pediatricManual:
            return 25_000_000
        }
    }

    var estimatedDownloadText: String {
        "about \(ByteCountFormatter.string(fromByteCount: estimatedDownloadBytes, countStyle: .file))"
    }
}

extension TrainingCatalog {
    func remainingDownloadEstimate(
        fileExists: (MediaAsset) -> Bool
    ) -> DownloadContentEstimate? {
        var uniqueAssets: [String: MediaAsset] = [:]

        for asset in packages.flatMap(\.assets) {
            if uniqueAssets[asset.filename]?.byteCount == nil || asset.byteCount != nil {
                uniqueAssets[asset.filename] = asset
            }
        }

        let remainingAssets = uniqueAssets.values.filter { !fileExists($0) }
        guard !remainingAssets.isEmpty else { return nil }

        return DownloadContentEstimate(
            remainingByteCount: remainingAssets.reduce(Int64(0)) { total, asset in
                total + asset.estimatedByteCount
            },
            remainingAssetCount: remainingAssets.count
        )
    }

    func package(with id: DownloadPackage.ID) -> DownloadPackage? {
        packages.first { $0.id == id }
    }

    func videoCourse(for mode: CourseLaunchMode) -> VideoCourse? {
        guard mode.kind == .video else { return nil }
        return videoCourses.first { $0.id == mode.id.rawValue }
    }

    func slideshow(for mode: CourseLaunchMode) -> Slideshow? {
        guard mode.kind == .slideshow else { return nil }
        return slideshows.first { $0.id == mode.id.rawValue }
    }
}

extension MediaAsset {
    var estimatedByteCount: Int64 {
        if let byteCount, byteCount > 0 {
            return byteCount
        }

        switch kind {
        case .video:
            return 100_000_000
        case .image:
            return 2_000_000
        case .pdf:
            return 25_000_000
        case .subtitle:
            return 100_000
        }
    }
}
