import Foundation

struct TrainingCatalog: Codable, Equatable {
    let schemaVersion: Int
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
}

struct DownloadPackage: Identifiable, Codable, Equatable {
    enum ID: String, Codable, Hashable {
        case cprSlideshow = "package.cpr-aed.slideshow"
        case cprVideo = "package.cpr-aed.video"
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
        switch id {
        case .cprSlideshow:
            700_000_000
        case .cprVideo:
            900_000_000
        case .firstAidSlideshow:
            750_000_000
        case .firstAidVideo:
            1_400_000_000
        case .pediatricSlideshow:
            750_000_000
        case .instructorManual, .studentManual, .pediatricManual:
            25_000_000
        }
    }

    var estimatedDownloadText: String {
        switch id {
        case .cprSlideshow:
            "about 700 MB"
        case .cprVideo:
            "about 900 MB"
        case .firstAidSlideshow:
            "about 750 MB"
        case .firstAidVideo:
            "about 1.4 GB"
        case .pediatricSlideshow:
            "about 750 MB"
        case .instructorManual, .studentManual, .pediatricManual:
            "less than 25 MB"
        }
    }
}

extension TrainingCatalog {
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
