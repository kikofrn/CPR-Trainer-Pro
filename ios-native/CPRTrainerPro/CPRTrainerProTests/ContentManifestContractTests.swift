import XCTest
@testable import CPRTrainerPro

final class ContentManifestContractTests: XCTestCase {
    private var catalog: TrainingCatalog!

    override func setUpWithError() throws {
        catalog = try Self.loadCatalog()
    }

    override func tearDown() {
        catalog = nil
        super.tearDown()
    }

    func testCatalogExcludesSpanishContentForInitialNativeBuild() {
        var strings: [String] = []

        for course in catalog.courses {
            strings.append(contentsOf: [course.title, course.subtitle, course.artworkName])
            strings.append(contentsOf: course.modes.map(\.title))
        }

        for videoCourse in catalog.videoCourses {
            strings.append(contentsOf: [videoCourse.id, videoCourse.title, videoCourse.shortTitle, videoCourse.manualFilename])
            for chapter in videoCourse.chapters {
                strings.append(contentsOf: [chapter.id, chapter.title, chapter.filename, chapter.subtitle ?? ""])
            }
        }

        for slideshow in catalog.slideshows {
            strings.append(contentsOf: [slideshow.id, slideshow.title])
            for slide in slideshow.slides {
                strings.append(contentsOf: [slide.id, slide.title, slide.filename])
            }
        }

        for manual in catalog.manuals {
            strings.append(contentsOf: [manual.id, manual.title, manual.description, manual.filename, manual.thumbnail])
        }

        for package in catalog.packages {
            strings.append(contentsOf: [package.id.rawValue, package.title])
            for asset in package.assets {
                strings.append(contentsOf: [asset.id, asset.filename])
            }
        }

        let searchableText = strings.joined(separator: "\n").lowercased()

        XCTAssertFalse(searchableText.contains("spanish"))
        XCTAssertFalse(searchableText.contains("espan"))
        XCTAssertFalse(searchableText.contains("cpr-aed-spanish"))
        XCTAssertFalse(searchableText.contains("first-aid-spanish"))
    }

    func testCourseShapeMatchesInstructorWorkflow() throws {
        XCTAssertEqual(catalog.courses.map(\.id), [.cprAED, .firstAid])

        let cpr = try XCTUnwrap(catalog.courses.first { $0.id == .cprAED })
        XCTAssertEqual(cpr.modes.map(\.id), [.cprSlideshow, .cprVideo])
        XCTAssertEqual(cpr.modes.first?.kind, .slideshow)

        let firstAid = try XCTUnwrap(catalog.courses.first { $0.id == .firstAid })
        XCTAssertEqual(firstAid.modes.map(\.id), [.firstAidSlideshow, .firstAidVideo, .pediatricSlideshow])
        XCTAssertEqual(firstAid.modes.first?.kind, .slideshow)
        XCTAssertEqual(firstAid.modes.last?.kind, .slideshow)
        XCTAssertEqual(firstAid.modes.last?.packageID, .pediatricSlideshow)
    }

    func testPrimarySlideshowsAndVideoCoursesArePresent() throws {
        XCTAssertEqual(catalog.videoCourses.map(\.id).sorted(), ["cpr-aed", "first-aid"])
        XCTAssertEqual(catalog.slideshows.map(\.id).sorted(), [
            "cpr-aed-course",
            "first-aid-course",
            "pediatric-first-aid-course"
        ])

        let cprSlideshow = try XCTUnwrap(catalog.slideshows.first { $0.id == "cpr-aed-course" })
        let firstAidSlideshow = try XCTUnwrap(catalog.slideshows.first { $0.id == "first-aid-course" })
        let pediatricSlideshow = try XCTUnwrap(catalog.slideshows.first { $0.id == "pediatric-first-aid-course" })

        XCTAssertEqual(cprSlideshow.slides.count, 40)
        XCTAssertEqual(firstAidSlideshow.slides.count, 46)
        XCTAssertEqual(pediatricSlideshow.slides.count, 47)
        XCTAssertTrue(cprSlideshow.slides.contains { $0.type == .image })
        XCTAssertTrue(cprSlideshow.slides.contains { $0.type == .video })
        XCTAssertTrue(firstAidSlideshow.slides.contains { $0.type == .video })
        XCTAssertTrue(pediatricSlideshow.slides.contains { $0.type == .video })
    }

    func testInstructorTipsCoverEveryBundledSlideshowSlide() throws {
        let bundle = Bundle(for: ContentManifestContractTests.self)
        let tips = try InstructorTipsService.loadTips(from: bundle)

        XCTAssertEqual(Set(tips.keys), Set(catalog.slideshows.map(\.id)))

        for slideshow in catalog.slideshows {
            let slideshowTips = try XCTUnwrap(tips[slideshow.id])
            XCTAssertEqual(slideshowTips.count, slideshow.slides.count)

            for (slide, tip) in zip(slideshow.slides, slideshowTips) {
                XCTAssertEqual(tip.slideID, slide.id)
                XCTAssertFalse(tip.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                XCTAssertFalse(tip.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    func testDownloadPackagesPreserveExpectedAssets() throws {
        let expectedCounts: [DownloadPackage.ID: Int] = [
            .cprSlideshow: 44,
            .cprVideo: 62,
            .firstAidSlideshow: 47,
            .firstAidVideo: 88,
            .pediatricSlideshow: 48,
            .instructorManual: 1,
            .studentManual: 1,
            .pediatricManual: 1
        ]

        XCTAssertEqual(Set(catalog.packages.map(\.id)), Set(expectedCounts.keys))

        for (id, count) in expectedCounts {
            XCTAssertEqual(catalog.package(with: id)?.assets.count, count, "Unexpected asset count for \(id.rawValue)")
        }

        let cprVideo = try XCTUnwrap(catalog.package(with: .cprVideo))
        XCTAssertTrue(cprVideo.assets.contains { $0.filename == "05__EHAcademy - CPR AED Course Video-Recognizing the Emergency.mp4" })
        XCTAssertTrue(cprVideo.assets.contains { $0.filename == "31_EHAcademy - CPR AED Course Video-Conclusion.mp4.mp4" })
        XCTAssertTrue(cprVideo.assets.contains { $0.filename == "subtitles/31_EHAcademy - CPR AED Course Video-Conclusion.mp4.vtt" })
    }

    func testMediaURLsEncodeSpacesWithoutNormalizingFilenames() {
        let doubleUnderscoreURL = URLHelpers.mediaURL(
            forExactFilename: "05__EHAcademy - CPR AED Course Video-Recognizing the Emergency.mp4"
        )

        XCTAssertEqual(
            doubleUnderscoreURL.absoluteString,
            "https://media.ehacademy.com/05__EHAcademy%20-%20CPR%20AED%20Course%20Video-Recognizing%20the%20Emergency.mp4"
        )

        let leadingSlashURL = URLHelpers.mediaURL(
            forExactFilename: "/subtitles/31_EHAcademy - CPR AED Course Video-Conclusion.mp4.vtt"
        )

        XCTAssertEqual(
            leadingSlashURL.absoluteString,
            "https://media.ehacademy.com/subtitles/31_EHAcademy%20-%20CPR%20AED%20Course%20Video-Conclusion.mp4.vtt"
        )
    }

    func testDownloadQueueStoreRoundTripsPackagePlans() throws {
        let package = try XCTUnwrap(catalog.package(with: .cprSlideshow))
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let storeURL = directoryURL.appendingPathComponent("queue.json", isDirectory: false)
        let store = DownloadQueueStore(storeURL: storeURL)
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        let plan = DownloadQueueStore.PackagePlan(
            package: package,
            baseURL: URL(string: "https://media.ehacademy.com/")!
        )

        try store.save([plan])
        XCTAssertEqual(try store.load(), [plan])

        try store.remove(packageID: package.id)
        XCTAssertEqual(try store.load(), [])
    }

    func testSubtitleParserHandlesWebVTTTimingAndText() {
        let cues = SubtitleService.parseWebVTT(
            """
            WEBVTT

            1
            00:00:01.000 --> 00:00:03.500
            Hello <b>world</b>

            00:00:04,000 --> 00:00:06,250
            Second line
            continues
            """
        )

        XCTAssertEqual(cues.count, 2)
        XCTAssertEqual(cues[0].startTime, 1)
        XCTAssertEqual(cues[0].endTime, 3.5)
        XCTAssertEqual(cues[0].text, "Hello world")
        XCTAssertTrue(cues[1].contains(5))
        XCTAssertEqual(cues[1].text, "Second line\ncontinues")
    }

    func testSubtitleFilenameCandidatesIncludeLegacyMp4VTTQuirk() {
        let candidates = SubtitleService.candidateSubtitleFilenames(
            forMediaFilename: "31_EHAcademy - CPR AED Course Video-Conclusion.mp4.mp4"
        )

        XCTAssertEqual(candidates, [
            "subtitles/31_EHAcademy - CPR AED Course Video-Conclusion.mp4.vtt",
            "subtitles/31_EHAcademy - CPR AED Course Video-Conclusion.mp4.mp4.vtt"
        ])
    }

    private static func loadCatalog() throws -> TrainingCatalog {
        let bundle = Bundle(for: ContentManifestContractTests.self)
        let url = try XCTUnwrap(bundle.url(forResource: "content-manifest", withExtension: "json"))
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(TrainingCatalog.self, from: data)
    }
}
