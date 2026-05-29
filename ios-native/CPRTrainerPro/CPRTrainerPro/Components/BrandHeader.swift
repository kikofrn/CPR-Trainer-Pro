import SwiftUI
import UIKit

struct BrandHeader: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let logo = Self.logoImage {
                Image(uiImage: logo)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(height: 76, alignment: .leading)
                    .accessibilityLabel("Everyday Hero Academy")
            } else {
                Text("Everyday Hero Academy")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(.white)
            }

            Text("Choose the course mode before class, download it once, then train offline with confidence.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.70))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private static var logoImage: UIImage? {
        guard let url = Bundle.main.url(
            forResource: "EHAcademyTrainerProLogo.png",
            withExtension: nil,
            subdirectory: "Artwork"
        ) else {
            return nil
        }

        return UIImage(contentsOfFile: url.path)
    }
}
