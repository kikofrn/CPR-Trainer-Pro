import Foundation

struct SubtitleService {
    private let storageService: StorageService

    init(storageService: StorageService) {
        self.storageService = storageService
    }

    func cues(forMediaFilename filename: String) -> [SubtitleCue] {
        for subtitleFilename in Self.candidateSubtitleFilenames(forMediaFilename: filename) {
            guard
                storageService.fileExists(subtitleFilename),
                let url = try? storageService.localURL(for: subtitleFilename),
                let content = try? String(contentsOf: url, encoding: .utf8)
            else {
                continue
            }

            return Self.parseWebVTT(content)
        }

        return []
    }

    static func candidateSubtitleFilenames(forMediaFilename filename: String) -> [String] {
        let clean = filename
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "^/+", with: "", options: .regularExpression)

        if clean.hasPrefix("subtitles/") {
            return [clean]
        }

        let basename = (clean as NSString).lastPathComponent
        let withoutExtension = (basename as NSString).deletingPathExtension
        return [
            "subtitles/\(withoutExtension).vtt",
            "subtitles/\(basename).vtt"
        ]
    }

    static func parseWebVTT(_ content: String) -> [SubtitleCue] {
        let normalized = content
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let blocks = normalized.components(separatedBy: "\n\n")
        var cues: [SubtitleCue] = []

        for block in blocks {
            let lines = block
                .split(separator: "\n", omittingEmptySubsequences: false)
                .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }

            guard !lines.isEmpty else { continue }
            let firstLine = lines[0].uppercased()
            guard !firstLine.hasPrefix("WEBVTT"),
                  !firstLine.hasPrefix("NOTE"),
                  !firstLine.hasPrefix("STYLE")
            else {
                continue
            }

            guard let timingIndex = lines.firstIndex(where: { $0.contains("-->") }) else { continue }
            let timingParts = lines[timingIndex].components(separatedBy: "-->")
            guard timingParts.count == 2,
                  let startTime = parseTimestamp(timingParts[0]),
                  let endTime = parseTimestamp(timingParts[1].split(separator: " ").first.map(String.init) ?? timingParts[1])
            else {
                continue
            }

            let text = lines
                .dropFirst(timingIndex + 1)
                .joined(separator: "\n")
                .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)

            guard !text.isEmpty else { continue }
            cues.append(SubtitleCue(id: cues.count, startTime: startTime, endTime: endTime, text: text))
        }

        return cues
    }

    private static func parseTimestamp(_ rawValue: String) -> TimeInterval? {
        let cleaned = rawValue
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        let components = cleaned.split(separator: ":").map(String.init)
        guard components.count == 2 || components.count == 3 else { return nil }

        let hours: Double
        let minutes: Double
        let seconds: Double

        if components.count == 3 {
            guard let parsedHours = Double(components[0]),
                  let parsedMinutes = Double(components[1]),
                  let parsedSeconds = Double(components[2])
            else {
                return nil
            }

            hours = parsedHours
            minutes = parsedMinutes
            seconds = parsedSeconds
        } else {
            guard let parsedMinutes = Double(components[0]),
                  let parsedSeconds = Double(components[1])
            else {
                return nil
            }

            hours = 0
            minutes = parsedMinutes
            seconds = parsedSeconds
        }

        return hours * 3_600 + minutes * 60 + seconds
    }
}
