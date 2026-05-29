import SwiftUI

struct CourseCard: View {
    let course: Course
    let selectedMode: CourseLaunchMode?
    let downloadState: DownloadState
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 12) {
                artwork

                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .top, spacing: 10) {
                        Text(course.title)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(.white)
                            .lineLimit(3)
                            .fixedSize(horizontal: false, vertical: true)

                        Spacer(minLength: 8)

                        DownloadStatusBadge(state: downloadState)
                    }

                    Text(course.subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.70))
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack {
                        Text(selectedMode?.title ?? "Select Mode")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.Colors.peach)

                        Spacer()
                    }

                    if case .failed(let message) = downloadState {
                        Text(message)
                            .font(.caption)
                            .foregroundStyle(Theme.Colors.failure)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(16)
            .background(isSelected ? Theme.Colors.elevatedSurface : Theme.Colors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous)
                    .stroke(isSelected ? Theme.Colors.peach : Color.white.opacity(0.08), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var artwork: some View {
        ArtworkImage(
            name: artworkName,
            placeholderSystemName: course.id == .cprAED ? "heart.text.square.fill" : "cross.case.fill"
        )
        .frame(maxWidth: .infinity)
        .frame(height: 128)
        .clipped()
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous)
                .stroke(.white.opacity(0.12), lineWidth: 1)
        )
    }

    private var artworkName: String {
        switch selectedMode?.id {
        case .cprVideo:
            "CPR AED for All Ages with VA.webp"
        case .firstAidVideo:
            "First Aid for All Ages with VA.webp"
        case .pediatricSlideshow:
            "Pediatric First Aid Cover.webp"
        default:
            course.artworkName
        }
    }
}
