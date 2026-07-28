import SwiftUI

struct CourseCardCopy: Equatable {
    let title: String
    let modeTitle: String
    let bluebellBubbles: [String]
    let collapsibleDescription: String
}

struct CourseCard: View {
    let course: Course
    let selectedMode: CourseLaunchMode?
    let copy: CourseCardCopy
    let downloadState: DownloadState
    let isComingSoon: Bool
    let isSelected: Bool
    let onSelect: () -> Void
    let onStatusTap: () -> Void

    @State private var descriptionExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            artwork

            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(copy.title)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(copy.modeTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.Colors.peach)
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                statusBadge
            }

            VStack(alignment: .leading, spacing: 7) {
                ForEach(copy.bluebellBubbles, id: \.self) { bubbleText in
                    BluebellBubble(text: bubbleText)
                }
            }

            collapsibleDescription

            if case .failed(let message) = downloadState, isSelected {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(Theme.Colors.failure)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .buttonStyle(.plain)
        .padding(.vertical, 2)
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
        .onChange(of: copy) { _, _ in
            descriptionExpanded = false
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        if isComingSoon {
            Text("COMING SOON")
                .font(.caption2.weight(.black))
                .foregroundStyle(.black)
                .padding(.horizontal, 9)
                .padding(.vertical, 6)
                .background(Theme.Colors.peach)
                .clipShape(Capsule())
        } else if downloadState.isReady {
            DownloadStatusBadge(state: downloadState)
        } else {
            Button(action: onStatusTap) {
                DownloadStatusBadge(state: downloadState)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Download course")
        }
    }

    private var artwork: some View {
        ArtworkImage(
            name: artworkName,
            placeholderSystemName: course.id == .cprAED ? "heart.text.square.fill" : "cross.case.fill"
        )
        .frame(maxWidth: .infinity)
        .frame(height: 208)
        .overlay {
            if downloadState.isActiveDownload {
                DownloadAnimationOverlay(progress: downloadState.progressSnapshot)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous)
                .stroke(isSelected ? Theme.Colors.peach : .white.opacity(0.12), lineWidth: 1)
        )
    }

    private var collapsibleDescription: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    descriptionExpanded.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    Text("Course details")
                        .font(.subheadline.weight(.semibold))

                    Image(systemName: descriptionExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.bold))
                }
                .foregroundStyle(.white.opacity(0.72))
            }
            .buttonStyle(.plain)

            if descriptionExpanded {
                Text(copy.collapsibleDescription)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.70))
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private var artworkName: String {
        if isComingSoon {
            return course.id == .cprAED
                ? "Pediatric CPR AED Cover.webp"
                : "Pediatric First Aid Cover.webp"
        }
        switch selectedMode?.id {
        case .cprVideo:
            return "CPR AED for All Ages with VA.webp"
        case .firstAidVideo:
            return "First Aid for All Ages with VA.webp"
        case .pediatricCPRSlideshow:
            return "Pediatric CPR AED Cover.webp"
        case .pediatricSlideshow:
            return "Pediatric First Aid Cover.webp"
        default:
            return course.artworkName
        }
    }
}

private struct BluebellBubble: View {
    let text: String

    var body: some View {
        Label {
            Text(text)
                .fixedSize(horizontal: false, vertical: true)
        } icon: {
            Image(systemName: "checkmark.circle.fill")
                .imageScale(.small)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(Theme.Colors.tabItem.opacity(0.82))
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.controlRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Layout.controlRadius, style: .continuous)
                .stroke(.white.opacity(0.18), lineWidth: 1)
        )
        .shadow(color: Theme.Colors.tabItem.opacity(0.45), radius: 8, x: 0, y: 0)
    }
}
