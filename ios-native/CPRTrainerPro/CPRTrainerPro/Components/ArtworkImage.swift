import SwiftUI
import UIKit
import ImageIO

enum CourseArtworkState: String, CaseIterable, Sendable {
    case cprStandard
    case cprVirtualAssistant
    case cprPediatric
    case cprPediatricVirtualAssistant
    case firstAidStandard
    case firstAidVirtualAssistant
    case firstAidPediatric
    case firstAidPediatricVirtualAssistant

    var remoteKey: String {
        switch self {
        case .cprStandard:
            "App Thumbnails/CPR AED for All Ages Cover.png"
        case .cprVirtualAssistant:
            "App Thumbnails/CPR AED for All Ages with VA.png"
        case .cprPediatric:
            "App Thumbnails/Pedi CPR AED Cover.png"
        case .cprPediatricVirtualAssistant:
            "App Thumbnails/Pedi CPR AED with VA Cover.png"
        case .firstAidStandard:
            "App Thumbnails/First Aid for All Ages Cover.png"
        case .firstAidVirtualAssistant:
            "App Thumbnails/First Aid for All Ages with VA.png"
        case .firstAidPediatric:
            "App Thumbnails/Pedi First Aid Cover.png"
        case .firstAidPediatricVirtualAssistant:
            "App Thumbnails/Pedi First Aid with VA Cover.png"
        }
    }

    var bundledFallbackName: String {
        switch self {
        case .cprStandard:
            "CPR AED for All Ages Cover.webp"
        case .cprVirtualAssistant:
            "CPR AED for All Ages with VA.webp"
        case .cprPediatric, .cprPediatricVirtualAssistant:
            "Pediatric CPR AED Cover.webp"
        case .firstAidStandard:
            "First Aid for All Ages Cover.webp"
        case .firstAidVirtualAssistant:
            "First Aid for All Ages with VA.webp"
        case .firstAidPediatric, .firstAidPediatricVirtualAssistant:
            "Pediatric First Aid Cover.webp"
        }
    }
}

struct ArtworkImage: View {
    fileprivate enum Source: Equatable {
        case bundled(String)
        case course(CourseArtworkState)

        var taskID: String {
            switch self {
            case .bundled(let name):
                "bundle:\(name)"
            case .course(let state):
                "course:\(state.rawValue)"
            }
        }
    }

    private let source: Source
    let placeholderSystemName: String
    var cornerRadius: CGFloat = Theme.Layout.cardRadius
    @State private var image: UIImage?

    init(
        name: String,
        placeholderSystemName: String,
        cornerRadius: CGFloat = Theme.Layout.cardRadius
    ) {
        self.source = .bundled(name)
        self.placeholderSystemName = placeholderSystemName
        self.cornerRadius = cornerRadius
    }

    init(
        courseState: CourseArtworkState,
        placeholderSystemName: String,
        cornerRadius: CGFloat = Theme.Layout.cardRadius
    ) {
        self.source = .course(courseState)
        self.placeholderSystemName = placeholderSystemName
        self.cornerRadius = cornerRadius
    }

    var body: some View {
        ZStack {
            Theme.Colors.elevatedSurface

            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
            } else {
                Rectangle()
                    .fill(Theme.Colors.red.gradient)

                Image(systemName: placeholderSystemName)
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .task(id: source.taskID) {
            image = await CourseArtworkRepository.shared.localImage(for: source)
            if case .course(let state) = source,
               let refreshed = await CourseArtworkRepository.shared.refreshedImage(for: state) {
                image = refreshed
            }
        }
    }
}

private actor CourseArtworkRepository {
    static let shared = CourseArtworkRepository()

    private let cache = NSCache<NSString, UIImage>()
    private let storageService: StorageService
    private let versionStore: ContentVersionStore
    private let manifestClient = RemoteContentManifestClient.shared
    private let session: URLSession

    init() {
        let versionStore = ContentVersionStore(contentRevision: "experiment-3.0")
        self.versionStore = versionStore
        self.storageService = StorageService(
            contentRevision: "experiment-3.0",
            versionStore: versionStore
        )

        let configuration = URLSessionConfiguration.ephemeral
        configuration.waitsForConnectivity = false
        configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 45
        self.session = URLSession(configuration: configuration)
        cache.countLimit = 16
        cache.totalCostLimit = 24 * 1_024 * 1_024
    }

    func localImage(for source: ArtworkImage.Source) -> UIImage? {
        switch source {
        case .bundled(let name):
            return downsampledBundledImage(named: name)
        case .course(let state):
            if let downloaded = downsampledDownloadedImage(for: state.remoteKey) {
                return downloaded
            }
            return downsampledBundledImage(named: state.bundledFallbackName)
        }
    }

    func refreshedImage(for state: CourseArtworkState) async -> UIImage? {
        await refreshIfNeeded(state)
        if let downloaded = downsampledDownloadedImage(for: state.remoteKey) {
            return downloaded
        }
        return downsampledBundledImage(named: state.bundledFallbackName)
    }

    private func refreshIfNeeded(_ state: CourseArtworkState) async {
        guard
            let manifest = await manifestClient.fetch(),
            let remoteVersion = manifest.assetsByKey[state.remoteKey]?.version
        else {
            return
        }

        if storageService.hasDownloadedCopy(state.remoteKey) {
            if let installed = versionStore.installedVersion(for: state.remoteKey),
               !remoteVersion.representsUpdate(comparedTo: installed) {
                return
            }
            if storageService.fileSizeIfExists(state.remoteKey) == remoteVersion.byteCount,
               versionStore.installedVersion(for: state.remoteKey) == nil {
                try? versionStore.recordInstalled(
                    filename: state.remoteKey,
                    version: remoteVersion
                )
                return
            }
        }

        var components = URLComponents(
            url: URLHelpers.mediaURL(forExactFilename: state.remoteKey),
            resolvingAgainstBaseURL: false
        )
        if let eTag = remoteVersion.eTag {
            components?.queryItems = [URLQueryItem(name: "v", value: eTag)]
        }
        guard let remoteURL = components?.url else { return }

        do {
            var request = URLRequest(url: remoteURL)
            request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            request.timeoutInterval = 20
            request.allowsExpensiveNetworkAccess = UserDefaults.standard.bool(
                forKey: "downloads.allowExpensiveNetworkAccess"
            )
            request.setValue("CPRTrainerPro-iOS/3.0", forHTTPHeaderField: "User-Agent")
            let (data, response) = try await session.data(for: request)
            guard
                let response = response as? HTTPURLResponse,
                200..<300 ~= response.statusCode,
                Int64(data.count) == remoteVersion.byteCount,
                let receivedVersion = RemoteAssetVersion(response: response),
                remoteVersion.matches(receivedVersion)
            else {
                return
            }

            let temporaryURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
            try data.write(to: temporaryURL, options: .atomic)
            defer { try? FileManager.default.removeItem(at: temporaryURL) }

            let asset = MediaAsset(
                id: state.remoteKey,
                filename: state.remoteKey,
                kind: .image,
                byteCount: remoteVersion.byteCount,
                eTag: remoteVersion.eTag,
                lastModified: remoteVersion.lastModified
            )
            try storageService.moveDownloadedFile(
                from: temporaryURL,
                for: asset,
                expectedByteCount: remoteVersion.byteCount
            )
            try versionStore.recordInstalled(
                filename: state.remoteKey,
                version: receivedVersion
            )
            cache.removeObject(forKey: state.remoteKey as NSString)
        } catch {
            // Keep the last validated download or bundled fallback.
        }
    }

    private func downsampledDownloadedImage(for filename: String) -> UIImage? {
        guard storageService.hasDownloadedCopy(filename),
              let url = try? storageService.downloadDestinationURL(for: filename)
        else {
            return nil
        }
        return downsampledImage(at: url, cacheKey: filename)
    }

    private func downsampledBundledImage(named name: String) -> UIImage? {
        guard let url = Bundle.main.url(
            forResource: name,
            withExtension: nil,
            subdirectory: "Artwork"
        ) else {
            return nil
        }
        return downsampledImage(at: url, cacheKey: "bundle:\(name)")
    }

    private func downsampledImage(at url: URL, cacheKey: String) -> UIImage? {
        if let cached = cache.object(forKey: cacheKey as NSString) {
            return cached
        }

        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            return nil
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 1_024,
            kCGImageSourceShouldCacheImmediately: true
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(
            source,
            0,
            options as CFDictionary
        ) else {
            return nil
        }
        let image = UIImage(cgImage: cgImage)
        cache.setObject(
            image,
            forKey: cacheKey as NSString,
            cost: cgImage.bytesPerRow * cgImage.height
        )
        return image
    }
}
