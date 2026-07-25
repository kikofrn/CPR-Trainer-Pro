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

        let sharedPediatricCPRMedia: [String: String] = [
            "slide-12": "CPR AED Presentation Slides/13_EHAcademy - CPR AED Course Pres-Check Responsiveness.png",
            "slide-13": "CPR AED Presentation Slides/14_EHAcademy - CPR AED Course Pres--Getting Help.png",
            "slide-14": "CPR AED Presentation Slides/15_EHAcademy - CPR AED Course Pres-Check Breathing.png",
            "slide-15": "CPR AED Presentation Slides/16_EHAcademy - CPR AED Course Pres-Begin Chest Compressions.png",
            "slide-16": "CPR AED Presentation Slides/17_EHAcademy - CPR AED Course Pres-Chest Compressions Video.mp4",
            "slide-20": "CPR AED Presentation Slides/21_EHAcademy - CPR AED Course Pres-CPR Songs.mp4",
            "slide-25": "CPR AED Presentation Slides/26_EHAcademy - CPR AED Course Pres-Adult Scenario.png",
            "slide-26": "CPR AED Presentation Slides/29_EHAcademy - CPR AED Course Pres-Infant CPR.png",
            "slide-29": "CPR AED Presentation Slides/32_EHAcademy - CPR AED Course Pres-Infant Scenario.png",
            "slide-30": "CPR AED Presentation Slides/33_EHAcademy - CPR AED Course Pres-Mild Choking.png",
            "slide-31": "CPR AED Presentation Slides/34_EHAcademy - CPR AED Course Pres-Severe Choking.png",
            "slide-32": "CPR AED Presentation Slides/35_EHAcademy - CPR AED Course Pres-Choking Adult.png",
            "slide-33": "CPR AED Presentation Slides/36_EHAcademy - CPR AED Course Pres-Choking Child.png",
            "slide-34": "CPR AED Presentation Slides/37_EHAcademy - CPR AED Course Pres-Choking Infant.png"
        ]
        for (slideID, filename) in sharedPediatricCPRMedia {
            XCTAssertEqual(
                pediatricCPR.slides.first { $0.id == slideID }?.filename,
                filename,
                "Unexpected R2 shared-media mapping for \(slideID)"
            )
        }
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
            .pediatricCPRSlideshow: 38,
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

    func testDownloadManifestIncludesExactR2ByteCounts() throws {
        let remoteAssets = catalog.packages
            .flatMap(\.assets)
            .filter { $0.kind != .subtitle }

        for asset in catalog.packages.flatMap(\.assets) {
            XCTAssertGreaterThan(
                try XCTUnwrap(asset.byteCount),
                0,
                "Missing byte count for \(asset.filename)"
            )
        }

        let uniqueRemoteAssets = Dictionary(
            remoteAssets.map { ($0.filename, $0) },
            uniquingKeysWith: { first, duplicate in
                XCTAssertEqual(
                    first.byteCount,
                    duplicate.byteCount,
                    "Shared asset has inconsistent byte counts: \(first.filename)"
                )
                return first
            }
        )
        let totalRemoteByteCount = uniqueRemoteAssets.values.reduce(Int64(0)) { total, asset in
            total + (asset.byteCount ?? 0)
        }

        XCTAssertEqual(uniqueRemoteAssets.count, 230)
        XCTAssertEqual(totalRemoteByteCount, 2_153_052_471)
    }

    func testRemainingDownloadEstimateDeduplicatesAndExcludesSavedContent() throws {
        let allMissing = try XCTUnwrap(
            catalog.remainingDownloadEstimate { asset in
                asset.filename.hasPrefix("subtitles/")
            }
        )

        XCTAssertEqual(allMissing.remainingAssetCount, 230)
        XCTAssertEqual(allMissing.remainingByteCount, 2_153_052_471)
        XCTAssertEqual(allMissing.durationText, "about 12 min on a typical 25 Mbps connection")

        let savedAsset = try XCTUnwrap(
            catalog.packages
                .flatMap(\.assets)
                .first { $0.kind != .subtitle }
        )
        let savedByteCount = try XCTUnwrap(savedAsset.byteCount)
        let partiallyDownloaded = try XCTUnwrap(
            catalog.remainingDownloadEstimate { asset in
                asset.filename.hasPrefix("subtitles/") || asset.filename == savedAsset.filename
            }
        )

        XCTAssertEqual(partiallyDownloaded.remainingAssetCount, 229)
        XCTAssertEqual(
            partiallyDownloaded.remainingByteCount,
            allMissing.remainingByteCount - savedByteCount
        )
    }

    func testRemainingDownloadEstimateIsNilWhenEverythingExists() {
        XCTAssertNil(catalog.remainingDownloadEstimate { _ in true })
    }

    func testMediaAssetDecodingRemainsCompatibleWithPersistedLegacyPlans() throws {
        let data = Data(
            #"{"id":"legacy","filename":"legacy.mp4","kind":"video"}"#.utf8
        )
        let asset = try JSONDecoder().decode(MediaAsset.self, from: data)

        XCTAssertNil(asset.byteCount)
        XCTAssertEqual(asset.filename, "legacy.mp4")
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

    func testDownloadAllQueueStoreRoundTripsAndRemovesPlans() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let storeURL = directoryURL.appendingPathComponent("download-all.json", isDirectory: false)
        let store = DownloadAllQueueStore(storeURL: storeURL)
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        let plan = DownloadAllQueueStore.Plan(
            packageIDs: [.cprSlideshow, .pediatricCPRSlideshow, .firstAidSlideshow],
            baseURL: URL(string: "https://media.ehacademy.com/")!
        )

        try store.save(plan)
        XCTAssertEqual(try store.load(), plan)

        try store.remove()
        XCTAssertNil(try store.load())
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

    func testStorageRejectsWrongSizedDownloadsAndValidatesSavedAssets() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let temporaryURL = directoryURL.appendingPathComponent("incoming.tmp")
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )

        let asset = MediaAsset(
            id: "test.asset",
            filename: "Test Assets/course.mp4",
            kind: .video,
            byteCount: 3
        )
        let storage = StorageService(
            contentRevision: "size-check",
            supportDirectoryURL: directoryURL
        )

        try Data([0x01, 0x02]).write(to: temporaryURL)
        XCTAssertThrowsError(
            try storage.moveDownloadedFile(from: temporaryURL, for: asset)
        ) { error in
            guard case StorageService.StorageError.unexpectedFileSize(
                let filename,
                let expected,
                let actual
            ) = error else {
                return XCTFail("Unexpected error: \(error)")
            }

            XCTAssertEqual(filename, asset.filename)
            XCTAssertEqual(expected, 3)
            XCTAssertEqual(actual, 2)
        }

        try Data([0x01, 0x02, 0x03]).write(to: temporaryURL, options: .atomic)
        try storage.moveDownloadedFile(from: temporaryURL, for: asset)
        XCTAssertTrue(storage.fileExists(asset))

        let changedR2Asset = MediaAsset(
            id: asset.id,
            filename: asset.filename,
            kind: asset.kind,
            byteCount: 4
        )
        XCTAssertFalse(storage.fileExists(changedR2Asset))
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
