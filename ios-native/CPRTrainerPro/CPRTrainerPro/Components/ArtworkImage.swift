import SwiftUI
import UIKit

struct ArtworkImage: View {
    let name: String
    let placeholderSystemName: String
    var cornerRadius: CGFloat = Theme.Layout.cardRadius

    var body: some View {
        ZStack {
            if let image = Self.image(named: name) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
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
    }

    private static func image(named name: String) -> UIImage? {
        guard let url = Bundle.main.url(forResource: name, withExtension: nil, subdirectory: "Artwork") else {
            return nil
        }

        return UIImage(contentsOfFile: url.path)
    }
}
