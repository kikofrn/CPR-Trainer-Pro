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
        case firstAidSlideshow = "first-aid-course"
        case firstAidVideo = "first-aid"
        case pediatricSlideshow = "pediatric-first-aid-course"
    }

    enum Kind: String, Codable, Equatable {
        case slideshow
        case video
    }

    let id: ID
    let kind: Kind
    let title: String
    let packageID: DownloadPackage.ID
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
    case downloading(progress: DownloadProgressSnapshot)
    case ready
    case failed(message: String)

    var isReady: Bool {
        if case .ready = self { return true }
        return false
    }

    var isActiveDownload: Bool {
        switch self {
        case .queued, .downloading:
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

private extension MediaAsset {
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
