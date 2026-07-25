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
        XCTAssertEqual(
            cpr.modes.map(\.id),
            [.cprSlideshow, .cprVideo, .pediatricCPRSlideshow]
        )
        XCTAssertEqual(cpr.modes.first?.kind, .slideshow)
        XCTAssertEqual(cpr.modes.last?.kind, .slideshow)
        XCTAssertEqual(cpr.modes.last?.packageID, .pediatricCPRSlideshow)

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
            "pediatric-cpr-aed-course",
            "pediatric-first-aid-course"
        ])

        let cprSlideshow = try XCTUnwrap(catalog.slideshows.first { $0.id == "cpr-aed-course" })
        let firstAidSlideshow = try XCTUnwrap(catalog.slideshows.first { $0.id == "first-aid-course" })
        let pediatricFirstAid = try XCTUnwrap(catalog.slideshows.first { $0.id == "pediatric-first-aid-course" })
        let pediatricCPR = try XCTUnwrap(catalog.slideshows.first { $0.id == "pediatric-cpr-aed-course" })

        XCTAssertEqual(cprSlideshow.slides.count, 39)
        XCTAssertEqual(firstAidSlideshow.slides.count, 46)
        XCTAssertEqual(pediatricFirstAid.slides.count, 45)
        XCTAssertEqual(pediatricCPR.slides.count, 36)
        XCTAssertEqual(cprSlideshow.slides.filter { $0.type == .video }.count, 5)
        XCTAssertEqual(firstAidSlideshow.slides.filter { $0.type == .video }.count, 1)
        XCTAssertFalse(pediatricFirstAid.slides.contains { $0.type == .video })
        XCTAssertEqual(pediatricCPR.slides.filter { $0.type == .video }.count, 4)
    }

    func testExperimentThreeCorrectionsArePresent() throws {
        XCTAssertEqual(catalog.contentRevision, "experiment-3.0")

        let cprSlideshow = try XCTUnwrap(catalog.slideshows.first { $0.id == "cpr-aed-course" })
        XCTAssertEqual(cprSlideshow.slides.first { $0.id == "slide-6" }?.title, "What if something goes wrong")
        XCTAssertEqual(cprSlideshow.slides.first { $0.id == "slide-35" }?.title, "Choking Adult")

        let firstAidVideo = try XCTUnwrap(catalog.videoCourses.first { $0.id == "first-aid" })
        XCTAssertEqual(firstAidVideo.chapters.count, 45)
        XCTAssertEqual(firstAidVideo.chapters.first { $0.id == "fa-10" }?.duration, "0:43")
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
            .cprSlideshow: 43,
            .cprVideo: 60,
            .pediatricCPRSlideshow: 36,
            .firstAidSlideshow: 47,
            .firstAidVideo: 90,
            .pediatricSlideshow: 45,
            .instructorManual: 1,
            .studentManual: 1,
            .pediatricManual: 1
        ]

        XCTAssertEqual(Set(catalog.packages.map(\.id)), Set(expectedCounts.keys))

        for (id, count) in expectedCounts {
            XCTAssertEqual(catalog.package(with: id)?.assets.count, count, "Unexpected asset count for \(id.rawValue)")
        }

        let cprVideo = try XCTUnwrap(catalog.package(with: .cprVideo))
        XCTAssertTrue(cprVideo.assets.contains {
            $0.filename == "CPR AED VA Slides/05_EHAcademy - CPR AED Course Video-Recognizing the Emergency.mp4"
        })
        XCTAssertTrue(cprVideo.assets.contains {
            $0.filename == "CPR AED VA Slides/30_EHAcademy - CPR AED Course Video-Conclusion.mp4"
        })
        XCTAssertTrue(cprVideo.assets.contains {
            $0.filename == "subtitles/30_EHAcademy - CPR AED Course Video-Conclusion.vtt"
        })
    }

    func testMediaURLsEncodeSpacesAndPreserveContentFolders() {
        let courseURL = URLHelpers.mediaURL(
            forExactFilename: "CPR AED VA Slides/05_EHAcademy - CPR AED Course Video-Recognizing the Emergency.mp4"
        )

        XCTAssertEqual(
            courseURL.absoluteString,
            "https://media.ehacademy.com/CPR%20AED%20VA%20Slides/05_EHAcademy%20-%20CPR%20AED%20Course%20Video-Recognizing%20the%20Emergency.mp4"
        )

        let leadingSlashURL = URLHelpers.mediaURL(
            forExactFilename: "/subtitles/30_EHAcademy - CPR AED Course Video-Conclusion.vtt"
        )

        XCTAssertEqual(
            leadingSlashURL.absoluteString,
            "https://media.ehacademy.com/subtitles/30_EHAcademy%20-%20CPR%20AED%20Course%20Video-Conclusion.vtt"
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

    func testSubtitleFilenameCandidatesUseTheMediaBasename() {
        let candidates = SubtitleService.candidateSubtitleFilenames(
            forMediaFilename: "CPR AED VA Slides/30_EHAcademy - CPR AED Course Video-Conclusion.mp4"
        )

        XCTAssertEqual(candidates, [
            "subtitles/30_EHAcademy - CPR AED Course Video-Conclusion.vtt",
            "subtitles/30_EHAcademy - CPR AED Course Video-Conclusion.mp4.vtt"
        ])
    }

    func testRevisionedStorageDoesNotReuseLegacyMedia() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let legacyURL = directoryURL
            .appendingPathComponent("DownloadedMedia", isDirectory: true)
            .appendingPathComponent("stale.mp4", isDirectory: false)
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        try FileManager.default.createDirectory(
            at: legacyURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data([0x01]).write(to: legacyURL)

        let storage = StorageService(
            contentRevision: "experiment 3.0",
            supportDirectoryURL: directoryURL
        )

        XCTAssertEqual(
            try storage.downloadedMediaRoot.lastPathComponent,
            "DownloadedMedia-experiment-3.0"
        )
        XCTAssertFalse(storage.fileExists("stale.mp4"))

        try storage.removeLegacyDownloadedMedia()
        XCTAssertFalse(FileManager.default.fileExists(atPath: legacyURL.path))
    }

    func testRevisionedQueueDoesNotLoadLegacyPlans() throws {
        let package = try XCTUnwrap(catalog.package(with: .cprSlideshow))
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let legacyDirectoryURL = directoryURL
            .appendingPathComponent("DownloadQueue", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        try FileManager.default.createDirectory(
            at: legacyDirectoryURL,
            withIntermediateDirectories: true
        )
        try Data("stale".utf8).write(
            to: legacyDirectoryURL.appendingPathComponent("packages.json")
        )

        let store = DownloadQueueStore(
            contentRevision: "experiment 3.0",
            supportDirectoryURL: directoryURL
        )
        let plan = DownloadQueueStore.PackagePlan(
            package: package,
            baseURL: URL(string: "https://media.ehacademy.com/")!
        )

        XCTAssertEqual(try store.load(), [])
        try store.save([plan])
        XCTAssertEqual(try store.load(), [plan])
        XCTAssertTrue(
            FileManager.default.fileExists(
                atPath: directoryURL
                    .appendingPathComponent("DownloadQueue-experiment-3.0/packages.json")
                    .path
            )
        )

        try store.removeLegacyStore()
        XCTAssertFalse(FileManager.default.fileExists(atPath: legacyDirectoryURL.path))
    }

    func testManualOutlineFilterOmitsUntitledBookmarksOnly() {
        XCTAssertFalse(ManualTOCService.shouldIncludeOutlineTitle("Untitled"))
        XCTAssertFalse(ManualTOCService.shouldIncludeOutlineTitle("  UNTITLED  "))
        XCTAssertTrue(ManualTOCService.shouldIncludeOutlineTitle(""))
        XCTAssertTrue(ManualTOCService.shouldIncludeOutlineTitle("CPR Overview"))
    }

    @MainActor
    func testVirtualAssistantAndPediatricModesAreMutuallyExclusive() throws {
        let viewModel = AppViewModel()
        let cpr = try XCTUnwrap(viewModel.catalog.courses.first { $0.id == .cprAED })
        let firstAid = try XCTUnwrap(viewModel.catalog.courses.first { $0.id == .firstAid })

        viewModel.setVAEnabled(true, for: .cprAED)
        XCTAssertEqual(viewModel.primaryMode(for: cpr)?.id, .cprVideo)
        XCTAssertFalse(viewModel.pediatricFocused(for: .cprAED))

        viewModel.setPediatricFocused(true, for: .cprAED)
        XCTAssertFalse(viewModel.vaEnabled(for: .cprAED))
        XCTAssertEqual(viewModel.primaryMode(for: cpr)?.id, .pediatricCPRSlideshow)

        viewModel.setPediatricFocused(true, for: .firstAid)
        XCTAssertFalse(viewModel.vaEnabled(for: .firstAid))
        XCTAssertEqual(viewModel.primaryMode(for: firstAid)?.id, .pediatricSlideshow)

        viewModel.setVAEnabled(true, for: .firstAid)
        XCTAssertFalse(viewModel.pediatricFocused(for: .firstAid))
        XCTAssertEqual(viewModel.primaryMode(for: firstAid)?.id, .firstAidVideo)
    }

    func testVideoScrubberFormatsTimeLabels() {
        XCTAssertEqual(VideoCourseScrubberProgress.formattedTime(303), "5:03")
        XCTAssertEqual(VideoCourseScrubberProgress.formattedTime(3_903), "1:05:03")
        XCTAssertEqual(
            VideoCourseScrubberProgress.formattedRemainingTime(duration: 600, currentTime: 466),
            "-2:14"
        )
        XCTAssertEqual(
            VideoCourseScrubberProgress.formattedRemainingTime(duration: 10, currentTime: 10),
            "0:00"
        )
        XCTAssertEqual(
            VideoCourseScrubberProgress.formattedRemainingTime(duration: 10, currentTime: 9.9),
            "0:00"
        )
    }

    func testVideoScrubberRejectsInvalidDurations() {
        let invalidDurations: [TimeInterval] = [
            .nan,
            .infinity,
            -.infinity,
            0,
            -1
        ]

        for duration in invalidDurations {
            XCTAssertNil(VideoCourseScrubberProgress.sanitizedDuration(duration))
        }

        XCTAssertEqual(VideoCourseScrubberProgress.sanitizedDuration(12), 12)
    }

    func testVideoScrubberClampsSliderValuesAndKeepsNonZeroRange() {
        var progress = VideoCourseScrubberProgress()
        progress.duration = 90
        progress.currentTime = 120

        XCTAssertEqual(progress.sliderValue, 90)
        XCTAssertEqual(progress.sliderRange.lowerBound, 0)
        XCTAssertEqual(progress.sliderRange.upperBound, 90)

        progress.duration = 0

        XCTAssertEqual(progress.sliderRange.lowerBound, 0)
        XCTAssertEqual(progress.sliderRange.upperBound, 0.1)
    }

    func testVideoScrubberPreviewSetterOnlyWritesWhileScrubbing() {
        var progress = VideoCourseScrubberProgress()
        progress.duration = 100
        progress.currentTime = 20

        XCTAssertFalse(progress.updatePreviewIfScrubbing(to: 60))
        XCTAssertNil(progress.previewTime)
        XCTAssertEqual(progress.currentTime, 20)

        progress.isScrubbing = true

        XCTAssertTrue(progress.updatePreviewIfScrubbing(to: 60))
        XCTAssertEqual(progress.previewTime, 60)

        XCTAssertTrue(progress.updatePreviewIfScrubbing(to: 150))
        XCTAssertEqual(progress.previewTime, 100)
    }

    func testVideoScrubberClampsSeekTargetBeforeChapterEnd() {
        XCTAssertEqual(
            VideoCourseScrubberProgress.clampedSeekTarget(60, duration: 60),
            59.9,
            accuracy: 0.0001
        )
        XCTAssertEqual(VideoCourseScrubberProgress.clampedSeekTarget(-10, duration: 60), 0)
        XCTAssertEqual(VideoCourseScrubberProgress.clampedSeekTarget(15, duration: 0), 0)
    }

    func testVideoScrubberSeekTokenRaceIgnoresStaleCompletion() {
        let itemA = NSObject()
        let itemB = NSObject()
        let firstSeek = VideoCourseScrubberSeekContext(
            token: 1,
            chapterID: "chapter-1",
            itemID: ObjectIdentifier(itemA)
        )
        let secondSeek = VideoCourseScrubberSeekContext(
            token: 2,
            chapterID: "chapter-1",
            itemID: ObjectIdentifier(itemB)
        )

        XCTAssertFalse(
            firstSeek.isCurrent(
                activeToken: 2,
                currentChapterID: "chapter-1",
                currentItemID: ObjectIdentifier(itemA)
            )
        )
        XCTAssertTrue(
            secondSeek.isCurrent(
                activeToken: 2,
                currentChapterID: "chapter-1",
                currentItemID: ObjectIdentifier(itemB)
            )
        )
    }

    func testVideoScrubberChapterChangeRaceIgnoresOldCompletion() {
        let oldItem = NSObject()
        let newItem = NSObject()
        let oldChapterSeek = VideoCourseScrubberSeekContext(
            token: 1,
            chapterID: "chapter-1",
            itemID: ObjectIdentifier(oldItem)
        )

        XCTAssertFalse(
            oldChapterSeek.isCurrent(
                activeToken: 1,
                currentChapterID: "chapter-2",
                currentItemID: ObjectIdentifier(oldItem)
            )
        )
        XCTAssertFalse(
            oldChapterSeek.isCurrent(
                activeToken: 1,
                currentChapterID: "chapter-1",
                currentItemID: ObjectIdentifier(newItem)
            )
        )
    }

    private static func loadCatalog() throws -> TrainingCatalog {
        let bundle = Bundle(for: ContentManifestContractTests.self)
        let url = try XCTUnwrap(bundle.url(forResource: "content-manifest", withExtension: "json"))
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(TrainingCatalog.self, from: data)
    }
}
