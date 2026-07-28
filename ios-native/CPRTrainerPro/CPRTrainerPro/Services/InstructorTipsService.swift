import Foundation

struct InstructorSlideTip: Identifiable, Decodable, Equatable {
    let slideID: String
    let slideNumber: Int
    let title: String
    let body: String

    var id: String { slideID }
}

struct InstructorTipsService {
    static let shared = InstructorTipsService(bundle: .main)

    private let tipsBySlideshowID: [String: [InstructorSlideTip]]

    init(bundle: Bundle) {
        do {
            tipsBySlideshowID = try Self.loadTips(from: bundle)
        } catch {
            assertionFailure("Failed to load instructor-tips.json: \(error)")
            tipsBySlideshowID = [:]
        }
    }

    func tip(for slideshowID: String, slideID: String) -> InstructorSlideTip? {
        tipsBySlideshowID[slideshowID]?.first { $0.slideID == slideID }
    }

    func tips(for slideshowID: String) -> [InstructorSlideTip] {
        tipsBySlideshowID[slideshowID] ?? []
    }

    static func loadTips(from bundle: Bundle) throws -> [String: [InstructorSlideTip]] {
        guard let url = bundle.url(forResource: "instructor-tips", withExtension: "json") else {
            throw LoadingError.missingResource
        }

        let data = try Data(contentsOf: url)
        let manifest = try JSONDecoder().decode(InstructorTipsManifest.self, from: data)
        var result: [String: [InstructorSlideTip]] = [:]
        for slideshow in manifest.slideshows {
            var seenSlideIDs: Set<String> = []
            let uniqueTips = slideshow.tips.filter {
                seenSlideIDs.insert($0.slideID).inserted
            }
            result[slideshow.id] = uniqueTips
        }
        return result
    }
}

private struct InstructorTipsManifest: Decodable {
    let schemaVersion: Int
    let slideshows: [InstructorTipsSlideshow]
}

private struct InstructorTipsSlideshow: Decodable {
    let id: String
    let tips: [InstructorSlideTip]
}

private enum LoadingError: Error {
    case missingResource
}
