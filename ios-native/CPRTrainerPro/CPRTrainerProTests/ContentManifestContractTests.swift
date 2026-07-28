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

    func testInteractiveTabOrderMetadataAndBoundariesAreStable() {
        XCTAssertEqual(
            AppTab.orderedTabs,
            [.cprAED, .firstAid, .manuals, .sendCerts, .settings]
        )
        XCTAssertEqual(
            AppTab.orderedTabs.map(\.tabTitle),
            ["CPR/AED", "First Aid", "Manuals", "Send Certs", "Settings"]
        )
        XCTAssertEqual(Set(AppTab.orderedTabs.map(\.accessibilityIdentifier)).count, 5)
        XCTAssertTrue(AppTab.orderedTabs.allSatisfy { !$0.systemImageName.isEmpty })

        XCTAssertEqual(AppTab.cprAED.adjacentTab(direction: -1), .cprAED)
        XCTAssertEqual(AppTab.cprAED.adjacentTab(direction: 1), .firstAid)
        XCTAssertEqual(AppTab.settings.adjacentTab(direction: -1), .sendCerts)
        XCTAssertEqual(AppTab.settings.adjacentTab(direction: 1), .settings)
    }

    func testPagerStateMachineCannotStrandProgrammaticTransitionDuringPan() {
        var state = TabPagerStateMachine(currentIndex: 0)
        let staleProgrammaticID = state.beginProgrammaticTransition(to: 1)
        state.beginInteractiveTransition(to: 2)

        XCTAssertNil(state.programmaticTransitionID)
        XCTAssertFalse(
            state.finishProgrammaticTransition(
                id: staleProgrammaticID,
                visibleIndex: 1
            )
        )

        state.queueRequest(3)
        state.queueRequest(4)
        XCTAssertTrue(state.finishInteractiveTransition(visibleIndex: 2))
        XCTAssertEqual(state.currentIndex, 2)
        XCTAssertEqual(state.takeQueuedRequest(), 4)
        XCTAssertFalse(state.hasTransitionInFlight)
    }

    func testPagerStateMachineIdleRecoveryClearsEveryBusyMarker() {
        var state = TabPagerStateMachine(currentIndex: 1)
        _ = state.beginProgrammaticTransition(to: 3)
        state.queueRequest(4)

        XCTAssertTrue(state.hasTransitionInFlight)
        XCTAssertTrue(state.recoverAtIdle(visibleIndex: 3))
        XCTAssertFalse(state.hasTransitionInFlight)
        XCTAssertEqual(state.currentIndex, 3)
        XCTAssertEqual(state.takeQueuedRequest(), 4)
        XCTAssertNil(state.takeQueuedRequest())
    }

    func testTransferNetworkPolicyDistinguishesWiFiFromCellular() {
        let wifi = TransferNetworkPolicySnapshot(
            isKnown: true,
            isSatisfied: true,
            isExpensive: false,
            allowsCellular: false
        )
        let blockedCellular = TransferNetworkPolicySnapshot(
            isKnown: true,
            isSatisfied: true,
            isExpensive: true,
            allowsCellular: false
        )
        let approvedCellular = TransferNetworkPolicySnapshot(
            isKnown: true,
            isSatisfied: true,
            isExpensive: true,
            allowsCellular: true
        )

        XCTAssertTrue(wifi.isConfirmedWiFi)
        XCTAssertTrue(wifi.allowsTransfers)
        XCTAssertFalse(blockedCellular.isConfirmedWiFi)
        XCTAssertFalse(blockedCellular.allowsTransfers)
        XCTAssertTrue(approvedCellular.allowsTransfers)
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

    func testCatalogHasNoDuplicateTransferFilenamesAcrossPackages() {
        let filenames = catalog.packages.flatMap(\.assets).map(\.filename)
        XCTAssertEqual(Set(filenames).count, filenames.count)
    }

    func testCourseShapeMatchesInstructorWorkflow() throws {
        XCTAssertEqual(catalog.courses.map(\.id), [.cprAED, .firstAid])

        let cpr = try XCTUnwrap(catalog.courses.first { $0.id == .cprAED })
        XCTAssertEqual(
            cpr.modes.map(\.id),
            [
                .cprSlideshow,
                .cprVideo,
                .pediatricCPRSlideshow,
                .pediatricCPRVideo
            ]
        )
        XCTAssertEqual(cpr.modes.first?.kind, .slideshow)
        XCTAssertEqual(cpr.modes[2].kind, .slideshow)
        XCTAssertEqual(cpr.modes[2].packageID, .pediatricCPRSlideshow)
        XCTAssertFalse(cpr.modes[3].isAvailable)
        XCTAssertNil(cpr.modes[3].packageID)

        let firstAid = try XCTUnwrap(catalog.courses.first { $0.id == .firstAid })
        XCTAssertEqual(
            firstAid.modes.map(\.id),
            [
                .firstAidSlideshow,
                .firstAidVideo,
                .pediatricSlideshow,
                .pediatricFirstAidVideo
            ]
        )
        XCTAssertEqual(firstAid.modes.first?.kind, .slideshow)
        XCTAssertEqual(firstAid.modes[2].kind, .slideshow)
        XCTAssertEqual(firstAid.modes[2].packageID, .pediatricSlideshow)
        XCTAssertFalse(firstAid.modes[3].isAvailable)
        XCTAssertNil(firstAid.modes[3].packageID)
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

        let authoritativePediatricCPRMedia: [String: (title: String, filename: String)] = [
            "slide-12": (
                "Assessment and Activation - Check Responsiveness",
                "Pedi CPR Presentation Slides/12_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Check Responsiveness.png"
            ),
            "slide-13": (
                "Assessment and Activation - Getting Help",
                "Pedi CPR Presentation Slides/13_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Getting Help.png"
            ),
            "slide-14": (
                "Assessment and Activation - Check Breathing",
                "Pedi CPR Presentation Slides/14_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Check Breathing.png"
            ),
            "slide-15": (
                "Assessment and Activation - Begin Chest Compressions",
                "Pedi CPR Presentation Slides/15_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Begin Chest Compressions.png"
            ),
            "slide-16": (
                "Chest Compression Effect",
                "Pedi CPR Presentation Slides/16_EHAcademy - Pedi CPR AED Course Pres-Chest Compression Effect Video.mp4"
            ),
            "slide-20": (
                "CPR Song",
                "Pedi CPR Presentation Slides/20_EHAcademy - Pedi CPR AED Course Pres-CPR Song.mp4"
            ),
            "slide-25": (
                "Put it all together",
                "Pedi CPR Presentation Slides/25_EHAcademy - Pedi CPR AED Course Pres-Put it all together.png"
            ),
            "slide-26": (
                "Infant Assessment",
                "Pedi CPR Presentation Slides/26_EHAcademy - Pedi CPR AED Course Pres-Infant Assessment.png"
            ),
            "slide-29": (
                "Infant AED Use",
                "Pedi CPR Presentation Slides/29_EHAcademy - Pedi CPR AED Course Pres-Infant AED Use.png"
            ),
            "slide-30": (
                "Infant Scenario",
                "Pedi CPR Presentation Slides/30_EHAcademy - Pedi CPR AED Course Pres-Infant Scenario.png"
            ),
            "slide-31": (
                "Mild Choking",
                "Pedi CPR Presentation Slides/31_EHAcademy - Pedi CPR AED Course Pres-Mild Choking.png"
            ),
            "slide-32": (
                "Severe Choking",
                "Pedi CPR Presentation Slides/32_EHAcademy - Pedi CPR AED Course Pres-Severe Choking.png"
            ),
            "slide-33": (
                "Choking Relief Child",
                "Pedi CPR Presentation Slides/33_EHAcademy - Pedi CPR AED Course Pres-Choking Relief Child.png"
            ),
            "slide-34": (
                "Choking Relief Infant",
                "Pedi CPR Presentation Slides/34_EHAcademy - Pedi CPR AED Course Pres-Choking Relief Infant.png"
            )
        ]
        for (slideID, expected) in authoritativePediatricCPRMedia {
            let slide = pediatricCPR.slides.first { $0.id == slideID }
            XCTAssertEqual(slide?.title, expected.title, "Unexpected title for \(slideID)")
            XCTAssertEqual(slide?.filename, expected.filename, "Unexpected R2 object for \(slideID)")
        }

        for slide in pediatricCPR.slides {
            XCTAssertTrue(
                slide.filename.hasPrefix("Pedi CPR Presentation Slides/"),
                "Pediatric CPR must not fall back to adult media: \(slide.filename)"
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
            $0.filename == "Subtitles/30_EHAcademy - CPR AED Course Video-Conclusion.vtt"
        })
    }

    func testDownloadManifestIncludesExactR2ByteCounts() throws {
        let remoteAssets = catalog.packages
            .flatMap(\.assets)
            .filter { $0.eTag != nil }

        for asset in catalog.packages.flatMap(\.assets) {
            XCTAssertGreaterThan(
                try XCTUnwrap(asset.byteCount),
                0,
                "Missing byte count for \(asset.filename)"
            )
            if asset.eTag != nil {
                XCTAssertFalse(
                    try XCTUnwrap(asset.eTag).isEmpty,
                    "Missing R2 ETag for \(asset.filename)"
                )
                let lastModified = try XCTUnwrap(asset.lastModified)
                XCTAssertTrue(
                    Self.httpDateFormatter.date(from: lastModified) != nil
                        || Self.fractionalISO8601DateFormatter.date(from: lastModified) != nil
                        || ISO8601DateFormatter().date(from: lastModified) != nil,
                    "Missing or invalid R2 Last-Modified for \(asset.filename)"
                )
            }
        }

        let uniqueRemoteAssets = Dictionary(
            remoteAssets.map { ($0.filename, $0) },
            uniquingKeysWith: { first, duplicate in
                XCTAssertEqual(
                    first.byteCount,
                    duplicate.byteCount,
                    "Shared asset has inconsistent byte counts: \(first.filename)"
                )
                XCTAssertEqual(
                    first.eTag,
                    duplicate.eTag,
                    "Shared asset has inconsistent ETags: \(first.filename)"
                )
                XCTAssertEqual(
                    first.lastModified,
                    duplicate.lastModified,
                    "Shared asset has inconsistent Last-Modified values: \(first.filename)"
                )
                return first
            }
        )
        XCTAssertGreaterThan(uniqueRemoteAssets.count, 0)
    }

    func testRemainingDownloadEstimateDeduplicatesAndExcludesSavedContent() throws {
        let allMissing = try XCTUnwrap(
            catalog.remainingDownloadEstimate { asset in
                asset.filename.lowercased().hasPrefix("subtitles/")
            }
        )

        let uniqueMissingAssets = Dictionary(
            catalog.packages
                .flatMap(\.assets)
                .filter { !$0.filename.lowercased().hasPrefix("subtitles/") }
                .map { ($0.filename, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        let expectedByteCount = uniqueMissingAssets.values.reduce(Int64(0)) {
            $0 + ($1.byteCount ?? 0)
        }

        XCTAssertEqual(
            allMissing.remainingAssetCount,
            uniqueMissingAssets.count
        )
        XCTAssertEqual(allMissing.remainingByteCount, expectedByteCount)
        XCTAssertFalse(allMissing.durationText.isEmpty)

        let savedAsset = try XCTUnwrap(
            catalog.packages
                .flatMap(\.assets)
                .first { $0.kind != .subtitle }
        )
        let savedByteCount = try XCTUnwrap(savedAsset.byteCount)
        let partiallyDownloaded = try XCTUnwrap(
            catalog.remainingDownloadEstimate { asset in
                asset.filename.lowercased().hasPrefix("subtitles/")
                    || asset.filename == savedAsset.filename
            }
        )

        XCTAssertEqual(partiallyDownloaded.remainingAssetCount, 243)
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
        XCTAssertNil(asset.eTag)
        XCTAssertNil(asset.lastModified)
        XCTAssertEqual(asset.filename, "legacy.mp4")
    }

    func testRemoteVersionDetectsEverySupportedChangeSignal() {
        let installed = RemoteAssetVersion(
            byteCount: 100,
            eTag: #""version-one""#,
            lastModified: "Mon, 20 Jul 2026 12:00:00 GMT"
        )

        XCTAssertFalse(installed.representsUpdate(comparedTo: installed))
        XCTAssertTrue(
            RemoteAssetVersion(
                byteCount: 101,
                eTag: installed.eTag,
                lastModified: installed.lastModified
            )
            .representsUpdate(comparedTo: installed)
        )
        XCTAssertTrue(
            RemoteAssetVersion(
                byteCount: installed.byteCount,
                eTag: #""version-two""#,
                lastModified: installed.lastModified
            )
            .representsUpdate(comparedTo: installed)
        )
        XCTAssertFalse(
            RemoteAssetVersion(
                byteCount: installed.byteCount,
                eTag: installed.eTag,
                lastModified: "Tue, 21 Jul 2026 12:00:00 GMT"
            )
            .representsUpdate(comparedTo: installed)
        )
        XCTAssertFalse(
            RemoteAssetVersion(
                byteCount: installed.byteCount,
                eTag: installed.eTag,
                lastModified: "Sun, 19 Jul 2026 12:00:00 GMT"
            )
            .representsUpdate(comparedTo: installed)
        )
    }

    func testRemoteVersionMatchRequiresExactAvailableMetadata() {
        let expected = RemoteAssetVersion(
            byteCount: 100,
            eTag: #""same-object""#,
            lastModified: "Mon, 20 Jul 2026 12:00:00 GMT"
        )

        XCTAssertTrue(expected.matches(expected))
        XCTAssertFalse(
            expected.matches(
                RemoteAssetVersion(
                    byteCount: 99,
                    eTag: expected.eTag,
                    lastModified: expected.lastModified
                )
            )
        )
        XCTAssertFalse(
            expected.matches(
                RemoteAssetVersion(
                    byteCount: expected.byteCount,
                    eTag: nil,
                    lastModified: expected.lastModified
                )
            )
        )
        XCTAssertTrue(
            expected.matches(
                RemoteAssetVersion(
                    byteCount: expected.byteCount,
                    eTag: expected.eTag,
                    lastModified: nil
                )
            )
        )
    }

    func testContentVersionStoreAdoptsAndPersistsInstalledVersions() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let storeURL = directoryURL.appendingPathComponent("versions.json")
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        let bundledAsset = MediaAsset(
            id: "test.asset",
            filename: "Test Assets/course.mp4",
            kind: .video,
            byteCount: 3,
            eTag: #""bundled""#,
            lastModified: "Mon, 20 Jul 2026 12:00:00 GMT"
        )
        let installedAt = Date(timeIntervalSince1970: 1_790_000_000)
        let checkedAt = installedAt.addingTimeInterval(60)
        let store = ContentVersionStore(storeURL: storeURL)

        try store.adoptBundledVersionsIfNeeded([bundledAsset], now: installedAt)
        XCTAssertEqual(
            store.installedVersion(for: bundledAsset.filename),
            RemoteAssetVersion(asset: bundledAsset)
        )
        XCTAssertEqual(store.record(for: bundledAsset.filename)?.installedAt, installedAt)
        XCTAssertNil(store.record(for: bundledAsset.filename)?.lastCheckedAt)

        try store.markChecked(filename: bundledAsset.filename, at: checkedAt)
        let reloadedStore = ContentVersionStore(storeURL: storeURL)
        XCTAssertEqual(
            reloadedStore.record(for: bundledAsset.filename)?.lastCheckedAt,
            checkedAt
        )

        let downloadedVersion = RemoteAssetVersion(
            byteCount: 4,
            eTag: #""downloaded""#,
            lastModified: "Tue, 21 Jul 2026 12:00:00 GMT"
        )
        try reloadedStore.recordInstalled(
            filename: bundledAsset.filename,
            version: downloadedVersion,
            installedAt: checkedAt
        )

        let finalStore = ContentVersionStore(storeURL: storeURL)
        XCTAssertEqual(
            finalStore.installedVersion(for: bundledAsset.filename),
            downloadedVersion
        )
        XCTAssertEqual(
            finalStore.record(for: bundledAsset.filename)?.lastCheckedAt,
            checkedAt
        )
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

    func testContentUpdatePlanStoreRoundTripsAndRemovesPlans() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let storeURL = directoryURL.appendingPathComponent("updates.json")
        let store = ContentUpdatePlanStore(storeURL: storeURL)
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        let asset = MediaAsset(
            id: "test.asset",
            filename: "Test Assets/course.mp4",
            kind: .video,
            byteCount: 3,
            eTag: #""old""#,
            lastModified: "Mon, 20 Jul 2026 12:00:00 GMT"
        )
        let candidate = ContentUpdateCandidate(
            asset: asset,
            remoteVersion: RemoteAssetVersion(
                byteCount: 4,
                eTag: #""new""#,
                lastModified: "Tue, 21 Jul 2026 12:00:00 GMT"
            )
        )
        let plan = ContentUpdatePlanStore.Plan(
            pending: [
                .init(
                    candidate: candidate,
                    attempt: 1,
                    retryAfter: Date(timeIntervalSince1970: 1_790_000_000)
                )
            ],
            failed: [candidate]
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
            "Subtitles/30_EHAcademy - CPR AED Course Video-Conclusion.vtt",
            "Subtitles/30_EHAcademy - CPR AED Course Video-Conclusion.mp4.vtt",
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

    func testStorageAtomicallyReplacesAValidatedInstalledVersion() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let versionURL = directoryURL.appendingPathComponent("versions.json")
        let firstTemporaryURL = directoryURL.appendingPathComponent("first.tmp")
        let replacementTemporaryURL = directoryURL.appendingPathComponent("replacement.tmp")
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )

        let asset = MediaAsset(
            id: "test.asset",
            filename: "Test Assets/course.mp4",
            kind: .video,
            byteCount: 3,
            eTag: #""old""#,
            lastModified: "Mon, 20 Jul 2026 12:00:00 GMT"
        )
        let versionStore = ContentVersionStore(storeURL: versionURL)
        let storage = StorageService(
            contentRevision: "atomic-update",
            supportDirectoryURL: directoryURL,
            versionStore: versionStore
        )

        try Data([0x01, 0x02, 0x03]).write(to: firstTemporaryURL)
        try storage.moveDownloadedFile(from: firstTemporaryURL, for: asset)
        try versionStore.recordInstalled(
            filename: asset.filename,
            version: try XCTUnwrap(RemoteAssetVersion(asset: asset))
        )

        let replacementVersion = RemoteAssetVersion(
            byteCount: 4,
            eTag: #""new""#,
            lastModified: "Tue, 21 Jul 2026 12:00:00 GMT"
        )
        try Data([0x04, 0x05, 0x06, 0x07]).write(to: replacementTemporaryURL)
        try storage.moveDownloadedFile(
            from: replacementTemporaryURL,
            for: asset,
            expectedByteCount: replacementVersion.byteCount
        )
        try versionStore.recordInstalled(
            filename: asset.filename,
            version: replacementVersion
        )

        XCTAssertEqual(
            try Data(contentsOf: storage.localURL(for: asset.filename)),
            Data([0x04, 0x05, 0x06, 0x07])
        )
        XCTAssertTrue(storage.fileExists(asset))
    }

    func testRejectedReplacementLeavesInstalledFileUntouched() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let firstTemporaryURL = directoryURL.appendingPathComponent("first.tmp")
        let invalidReplacementURL = directoryURL.appendingPathComponent("invalid.tmp")
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
            contentRevision: "atomic-rejection",
            supportDirectoryURL: directoryURL
        )

        let originalData = Data([0x01, 0x02, 0x03])
        try originalData.write(to: firstTemporaryURL)
        try storage.moveDownloadedFile(from: firstTemporaryURL, for: asset)

        try Data([0x04, 0x05, 0x06]).write(to: invalidReplacementURL)
        XCTAssertThrowsError(
            try storage.moveDownloadedFile(
                from: invalidReplacementURL,
                for: asset,
                expectedByteCount: 4
            )
        )
        XCTAssertEqual(
            try Data(contentsOf: storage.localURL(for: asset.filename)),
            originalData
        )
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
    func testPediatricVirtualAssistantCombinationIsExplicitlyUnavailable() throws {
        let viewModel = AppViewModel()
        let cpr = try XCTUnwrap(viewModel.catalog.courses.first { $0.id == .cprAED })
        let firstAid = try XCTUnwrap(viewModel.catalog.courses.first { $0.id == .firstAid })
        viewModel.setVAEnabled(false, for: .cprAED)
        viewModel.setPediatricFocused(false, for: .cprAED)
        viewModel.setVAEnabled(false, for: .firstAid)
        viewModel.setPediatricFocused(false, for: .firstAid)
        defer {
            viewModel.setVAEnabled(false, for: .cprAED)
            viewModel.setPediatricFocused(false, for: .cprAED)
            viewModel.setVAEnabled(false, for: .firstAid)
            viewModel.setPediatricFocused(false, for: .firstAid)
        }

        viewModel.setVAEnabled(true, for: .cprAED)
        XCTAssertEqual(viewModel.primaryMode(for: cpr)?.id, .cprVideo)
        XCTAssertFalse(viewModel.pediatricFocused(for: .cprAED))

        viewModel.setPediatricFocused(true, for: .cprAED)
        XCTAssertTrue(viewModel.vaEnabled(for: .cprAED))
        XCTAssertTrue(viewModel.isUnavailableModeSelected(for: .cprAED))
        XCTAssertEqual(viewModel.primaryMode(for: cpr)?.id, .pediatricCPRVideo)
        XCTAssertFalse(viewModel.primaryMode(for: cpr)?.isAvailable ?? true)

        viewModel.setPediatricFocused(true, for: .firstAid)
        XCTAssertEqual(viewModel.primaryMode(for: firstAid)?.id, .pediatricSlideshow)

        viewModel.setVAEnabled(true, for: .firstAid)
        XCTAssertTrue(viewModel.pediatricFocused(for: .firstAid))
        XCTAssertTrue(viewModel.isUnavailableModeSelected(for: .firstAid))
        XCTAssertEqual(
            viewModel.primaryMode(for: firstAid)?.id,
            .pediatricFirstAidVideo
        )
        XCTAssertFalse(viewModel.primaryMode(for: firstAid)?.isAvailable ?? true)
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

    func testWeakAndQuotedETagsCanonicalize() {
        XCTAssertEqual(RemoteAssetVersion.canonicalETag(#" W/"abc123" "#), "abc123")
        XCTAssertEqual(RemoteAssetVersion.canonicalETag(#""abc123""#), "abc123")
        XCTAssertEqual(RemoteAssetVersion.canonicalETag("abc123"), "abc123")
        XCTAssertNil(RemoteAssetVersion.canonicalETag("  "))
    }

    func testRemoteManifestClientDecodesStrictExactKeysAndCanonicalETags() throws {
        let data = try JSONSerialization.data(withJSONObject: [
            "generated": "2026-07-28T12:00:00.123Z",
            "files": [
                [
                    "key": "Course/Chapter 01.mp4",
                    "etag": #" W/"version-one" "#,
                    "uploaded": "2026-07-28T11:00:00.000Z",
                    "size": 1234
                ]
            ]
        ])

        let decoded = try XCTUnwrap(
            RemoteContentManifestClient.decodePayload(data)
        )
        let asset = try XCTUnwrap(
            decoded.assetsByKey["Course/Chapter 01.mp4"]
        )
        XCTAssertEqual(asset.version.byteCount, 1234)
        XCTAssertEqual(asset.version.eTag, "version-one")
        XCTAssertNotNil(decoded.generatedAt)
    }

    func testRemoteManifestClientRejectsDuplicateOrUnsafeKeys() throws {
        let duplicate = try JSONSerialization.data(withJSONObject: [
            "files": [
                ["key": "Course/a.mp4", "size": 10],
                ["key": "Course/a.mp4", "size": 10]
            ]
        ])
        let unsafe = try JSONSerialization.data(withJSONObject: [
            "files": [
                ["key": "Course/../secret.mp4", "size": 10]
            ]
        ])

        XCTAssertNil(RemoteContentManifestClient.decodePayload(duplicate))
        XCTAssertNil(RemoteContentManifestClient.decodePayload(unsafe))
    }

    func testSchemaV1VersionStoreMigratesAllRecordsAndDatesToV2() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let storeURL = directoryURL.appendingPathComponent("versions.json")
        defer { try? FileManager.default.removeItem(at: directoryURL) }
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )

        let fixture = """
        {
          "schemaVersion": 1,
          "records": {
            "Course/one.mp4": {
              "filename": "Course/one.mp4",
              "version": {
                "byteCount": 123,
                "eTag": " W/\\\"quoted-etag\\\" ",
                "lastModified": "Mon, 20 Jul 2026 12:00:00 GMT"
              },
              "installedAt": 800000000,
              "lastCheckedAt": 800086400
            }
          }
        }
        """
        try Data(fixture.utf8).write(to: storeURL, options: [.atomic])

        let store = ContentVersionStore(storeURL: storeURL)
        let record = try XCTUnwrap(store.record(for: "Course/one.mp4"))
        XCTAssertEqual(record.version.eTag, "quoted-etag")
        XCTAssertNotNil(record.installedAt)
        XCTAssertNotNil(record.lastCheckedAt)

        let persisted = try JSONSerialization.jsonObject(
            with: Data(contentsOf: storeURL)
        ) as? [String: Any]
        XCTAssertEqual(persisted?["schemaVersion"] as? Int, 2)
    }

    func testFullyDownloadedSchemaV1StoreProducesNoFalseUpdateCandidates() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let storeURL = directoryURL.appendingPathComponent("versions.json")
        defer { try? FileManager.default.removeItem(at: directoryURL) }
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )

        let versionedAssets = catalog.packages
            .flatMap(\.assets)
            .filter { RemoteAssetVersion(asset: $0) != nil }
        var records: [String: Any] = [:]
        for asset in versionedAssets {
            let version = try XCTUnwrap(RemoteAssetVersion(asset: asset))
            var versionObject: [String: Any] = [
                "byteCount": version.byteCount
            ]
            if let eTag = version.eTag {
                versionObject["eTag"] = #" W/""# + eTag + #"""#
            }
            if let lastModified = version.lastModified {
                versionObject["lastModified"] = lastModified
            }
            records[asset.filename] = [
                "filename": asset.filename,
                "version": versionObject,
                "installedAt": 800_000_000,
                "lastCheckedAt": 800_086_400
            ]
        }
        let data = try JSONSerialization.data(
            withJSONObject: ["schemaVersion": 1, "records": records]
        )
        try data.write(to: storeURL, options: [.atomic])

        let store = ContentVersionStore(storeURL: storeURL)
        let falseCandidates = versionedAssets.filter { asset in
            guard
                let remote = RemoteAssetVersion(asset: asset),
                let installed = store.installedVersion(for: asset.filename)
            else {
                return true
            }
            return remote.representsUpdate(comparedTo: installed)
        }
        XCTAssertTrue(falseCandidates.isEmpty)
    }

    func testPersistedDownloadAndUpdatePlansTranslateObsoleteFilenames() throws {
        let alias = try XCTUnwrap(ContentStateMigrator.aliases.first)
        let correctedPackage = try XCTUnwrap(
            catalog.packages.first {
                $0.assets.contains { $0.filename == alias.newFilename }
            }
        )
        let correctedAsset = try XCTUnwrap(
            correctedPackage.assets.first { $0.filename == alias.newFilename }
        )
        let legacyAsset = MediaAsset(
            id: correctedAsset.id,
            filename: alias.oldFilename,
            kind: correctedAsset.kind,
            byteCount: correctedAsset.byteCount,
            eTag: correctedAsset.eTag,
            lastModified: correctedAsset.lastModified
        )
        let legacyPackage = correctedPackage.replacingAssets(
            correctedPackage.assets.map {
                $0.filename == alias.newFilename ? legacyAsset : $0
            }
        )
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        let queueStore = DownloadQueueStore(
            storeURL: directoryURL.appendingPathComponent("queue.json")
        )
        try queueStore.save([
            .init(package: legacyPackage, baseURL: catalog.mediaBaseURL)
        ])
        XCTAssertTrue(try queueStore.migrateObsoleteFilenames(using: catalog))
        let migratedQueue = try XCTUnwrap(queueStore.load().first)
        XCTAssertTrue(
            migratedQueue.package.assets.contains {
                $0.filename == alias.newFilename
            }
        )
        XCTAssertFalse(
            migratedQueue.package.assets.contains {
                $0.filename == alias.oldFilename
            }
        )

        let updateStore = ContentUpdatePlanStore(
            storeURL: directoryURL.appendingPathComponent("updates.json")
        )
        let version = try XCTUnwrap(RemoteAssetVersion(asset: correctedAsset))
        try updateStore.save(
            .init(
                pending: [
                    .init(
                        candidate: .init(
                            asset: legacyAsset,
                            remoteVersion: version
                        ),
                        attempt: 1,
                        retryAfter: nil
                    )
                ],
                failed: []
            )
        )
        XCTAssertTrue(try updateStore.migrateObsoleteFilenames(using: catalog))
        XCTAssertEqual(
            try updateStore.load()?.pending.first?.candidate.asset.filename,
            alias.newFilename
        )
    }

    func testContentStateMigrationRejectsTruncatedFileEvenWhenRecordMatches() throws {
        let alias = try XCTUnwrap(ContentStateMigrator.aliases.first)
        let correctedAsset = try XCTUnwrap(
            catalog.packages.flatMap(\.assets).first {
                $0.filename == alias.newFilename
            }
        )
        let correctedVersion = try XCTUnwrap(RemoteAssetVersion(asset: correctedAsset))
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        let versionStore = ContentVersionStore(
            storeURL: directoryURL.appendingPathComponent("versions.json")
        )
        let storage = StorageService(
            contentRevision: catalog.contentRevision,
            supportDirectoryURL: directoryURL,
            versionStore: versionStore
        )
        let oldURL = try storage.downloadDestinationURL(for: alias.oldFilename)
        try FileManager.default.createDirectory(
            at: oldURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data([0x00]).write(to: oldURL)
        try versionStore.recordInstalled(
            filename: alias.oldFilename,
            version: correctedVersion
        )

        let migrated = ContentStateMigrator(
            storageService: storage,
            versionStore: versionStore
        ).migrate(using: catalog)

        XCTAssertTrue(migrated.isEmpty)
        XCTAssertTrue(FileManager.default.fileExists(atPath: oldURL.path))
        XCTAssertFalse(storage.hasDownloadedCopy(alias.newFilename))
        XCTAssertNotNil(versionStore.record(for: alias.oldFilename))
        XCTAssertNil(versionStore.record(for: alias.newFilename))
    }

    func testAllEightCourseArtworkStatesHaveUniqueExactCloudKeysAndBundledFallbacks() {
        let states = CourseArtworkState.allCases
        XCTAssertEqual(states.count, 8)
        XCTAssertEqual(Set(states.map(\.remoteKey)).count, 8)

        let expectedKeys = Set([
            "App Thumbnails/CPR AED for All Ages Cover.png",
            "App Thumbnails/CPR AED for All Ages with VA.png",
            "App Thumbnails/First Aid for All Ages Cover.png",
            "App Thumbnails/First Aid for All Ages with VA.png",
            "App Thumbnails/Pedi CPR AED Cover.png",
            "App Thumbnails/Pedi CPR AED with VA Cover.png",
            "App Thumbnails/Pedi First Aid Cover.png",
            "App Thumbnails/Pedi First Aid with VA Cover.png"
        ])
        XCTAssertEqual(Set(states.map(\.remoteKey)), expectedKeys)

        for state in states {
            XCTAssertNotNil(
                Bundle.main.url(
                    forResource: state.bundledFallbackName,
                    withExtension: nil,
                    subdirectory: "Artwork"
                ),
                "Missing bundled fallback for \(state.rawValue)"
            )
        }
    }

    func testUpdatePromptFingerprintIsOrderIndependentButVersionSpecific() {
        let assetA = MediaAsset(
            id: "a",
            filename: "Course/a.mp4",
            kind: .video,
            byteCount: 100
        )
        let assetB = MediaAsset(
            id: "b",
            filename: "Course/b.mp4",
            kind: .video,
            byteCount: 200
        )
        let candidateA = ContentUpdateCandidate(
            asset: assetA,
            remoteVersion: .init(
                byteCount: 100,
                eTag: "\"version-a\"",
                lastModified: nil
            )
        )
        let candidateB = ContentUpdateCandidate(
            asset: assetB,
            remoteVersion: .init(
                byteCount: 200,
                eTag: "\"version-b\"",
                lastModified: nil
            )
        )
        XCTAssertEqual(
            ContentUpdateSummary(candidates: [candidateA, candidateB]).fingerprint,
            ContentUpdateSummary(candidates: [candidateB, candidateA]).fingerprint
        )

        let newerA = ContentUpdateCandidate(
            asset: assetA,
            remoteVersion: .init(
                byteCount: 100,
                eTag: "\"version-a-2\"",
                lastModified: nil
            )
        )
        XCTAssertNotEqual(
            ContentUpdateSummary(candidates: [candidateA, candidateB]).fingerprint,
            ContentUpdateSummary(candidates: [newerA, candidateB]).fingerprint
        )
    }

    func testPlaybackFailureKeepsTheActualReason() {
        XCTAssertEqual(
            PlaybackStatus.failed("Corrupt video data.").failureReason,
            "Corrupt video data."
        )
        XCTAssertNil(PlaybackStatus.paused.failureReason)
    }

    private static func loadCatalog() throws -> TrainingCatalog {
        let bundle = Bundle(for: ContentManifestContractTests.self)
        let url = try XCTUnwrap(bundle.url(forResource: "content-manifest", withExtension: "json"))
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(TrainingCatalog.self, from: data)
    }

    private static let httpDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE',' dd MMM yyyy HH':'mm':'ss 'GMT'"
        return formatter
    }()

    private static let fractionalISO8601DateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
