import Foundation

enum URLHelpers {
    static let mediaBaseURL = URL(string: "https://media.ehacademy.com/")!
    static let sendCertsURL = URL(string: "https://ehacademy.com/login")!

    static func mediaURL(forExactFilename filename: String) -> URL {
        let clean = filename.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "^/+", with: "", options: .regularExpression)

        return clean
            .split(separator: "/", omittingEmptySubsequences: true)
            .reduce(mediaBaseURL) { partialURL, component in
                partialURL.appendingPathComponent(String(component), isDirectory: false)
            }
    }
}
