import Foundation

struct ContentManifestService {
    func loadBundledCatalog() -> TrainingCatalog {
        guard let url = Bundle.main.url(forResource: "content-manifest", withExtension: "json") else {
            assertionFailure("Missing bundled content-manifest.json")
            return Self.fallbackCatalog
        }

        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(TrainingCatalog.self, from: data)
        } catch {
            assertionFailure("Failed to decode content-manifest.json: \(error)")
            return Self.fallbackCatalog
        }
    }
}

private extension ContentManifestService {
    static let fallbackCatalog = TrainingCatalog(
        schemaVersion: 1,
        mediaBaseURL: URLHelpers.mediaBaseURL,
        sendCertsURL: URLHelpers.sendCertsURL,
        courses: [
            Course(
                id: .cprAED,
                title: "CPR & AED for All Ages",
                subtitle: "Instructor-paced slideshow by default, with VA video as an optional mode.",
                artworkName: "CPR AED for All Ages Cover.webp",
                modes: [
                    CourseLaunchMode(id: .cprSlideshow, kind: .slideshow, title: "Slideshow", packageID: .cprSlideshow),
                    CourseLaunchMode(id: .cprVideo, kind: .video, title: "VA Video", packageID: .cprVideo)
                ]
            ),
            Course(
                id: .firstAid,
                title: "First Aid for All Ages",
                subtitle: "Instructor-paced slideshow by default. Pediatric Focused is a variant inside this course.",
                artworkName: "First Aid for All Ages Cover.webp",
                modes: [
                    CourseLaunchMode(id: .firstAidSlideshow, kind: .slideshow, title: "Slideshow", packageID: .firstAidSlideshow),
                    CourseLaunchMode(id: .firstAidVideo, kind: .video, title: "VA Video", packageID: .firstAidVideo),
                    CourseLaunchMode(id: .pediatricSlideshow, kind: .slideshow, title: "Pediatric Focused", packageID: .pediatricSlideshow)
                ]
            )
        ],
        videoCourses: [],
        slideshows: [],
        manuals: [],
        packages: []
    )
}

