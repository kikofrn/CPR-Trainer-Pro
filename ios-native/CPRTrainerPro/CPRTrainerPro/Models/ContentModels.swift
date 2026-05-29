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

enum DownloadState: Equatable {
    case notDownloaded
    case queued
    case downloading(progress: Double)
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
        if case .downloading(let progress) = self {
            return progress
        }

        return nil
    }
}

extension DownloadPackage {
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
