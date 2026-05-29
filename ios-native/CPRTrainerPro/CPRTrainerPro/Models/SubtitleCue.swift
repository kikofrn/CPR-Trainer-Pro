import Foundation

struct SubtitleCue: Identifiable, Equatable {
    let id: Int
    let startTime: TimeInterval
    let endTime: TimeInterval
    let text: String

    func contains(_ time: TimeInterval) -> Bool {
        time >= startTime && time <= endTime
    }
}
