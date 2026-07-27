import SwiftUI
import UIKit

struct SendCertsView: View {
    var showsBrandLogo = true
    var onHeaderProgressChange: ((CGFloat) -> Void)? = nil

    @Environment(\.openURL) private var openURL
    @State private var showsCertificationDetails = false

    var body: some View {
        NavigationStack {
            StickyBrandScrollView(
                title: "Send Certs",
                showsBrandLogo: showsBrandLogo,
                onHeaderProgressChange: onHeaderProgressChange
            ) {
                VStack(alignment: .leading, spacing: 18) {
                    portalIntro
                    workflowSteps

                    PrimaryActionButton(
                        title: "Open Instructor Portal",
                        systemImage: "arrow.up.right.square.fill",
                        action: {
                            openURL(URLHelpers.sendCertsURL)
                        }
                    )

                    Label("Opens securely in your default browser", systemImage: "info.circle")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.58))

                    sampleCards
                    certificationDetails
                }
            }
            .navigationTitle("")
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private var portalIntro: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "rosette")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(Theme.Colors.failure)
                .padding(14)
                .background(Theme.Colors.failure.opacity(0.16))
                .clipShape(Circle())

            Text("EH Academy Portal")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(.white)

            Text("Done teaching? Ready to certify your students? Access the secure EH Academy Instructor Portal to issue training cards and finalize your class.")
                .font(.body.weight(.medium))
                .foregroundStyle(.white.opacity(0.72))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var workflowSteps: some View {
        HStack(spacing: 10) {
            PortalStepCard(number: "1", title: "Secure Login", detail: "Use your instructor credentials.")
            PortalStepCard(number: "2", title: "Manage Classes", detail: "Select your active rosters.")
            PortalStepCard(number: "3", title: "Issue Cards", detail: "Award and email digital cards.")
        }
    }

    private var sampleCards: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Sample Certification Cards")
                .font(.headline.monospaced().weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(.white.opacity(0.82))

            ExactCertificationCardImage(
                title: "CPR AED & First Aid for All Ages",
                filename: "CPRAEDFAAllAgesSampleCard.png",
                accent: Theme.Colors.blue
            )

            ExactCertificationCardImage(
                title: "Pediatric Specific",
                subtitle: "Perfect for Childcare Facilities",
                filename: "PediatricCPRFASampleCard.png",
                accent: Theme.Colors.failure
            )
        }
        .padding(16)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
    }

    private var certificationDetails: some View {
        DisclosureGroup(isExpanded: $showsCertificationDetails) {
            Text("Everyday Hero Academy provides nationally recognized, fully compliant CPR and First Aid certifications built strictly on the latest 2025 AHA/ILCOR scientific standards. Because our curriculum mandates live, in-person skills assessments, our pediatric and adult cards meet or exceed all federal OSHA workplace safety requirements and satisfy state child-care licensing mandates including pediatric hands-on skills validation. To view our comprehensive state-by-state approval registry or download your compliance packet, visit ehacademy.com")
                .font(.footnote.weight(.medium))
                .foregroundStyle(.white.opacity(0.66))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
        } label: {
            Label("Certification Recognition Details", systemImage: "doc.text.magnifyingglass")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.Colors.tabItem)
        }
        .tint(Theme.Colors.tabItem)
        .padding(14)
        .background(Theme.Colors.elevatedSurface.opacity(0.76))
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
    }
}

private struct PortalStepCard: View {
    let number: String
    let title: String
    let detail: String

    var body: some View {
        VStack(spacing: 9) {
            Text(number)
                .font(.caption.weight(.bold))
                .foregroundStyle(Theme.Colors.tabItem)
                .frame(width: 34, height: 34)
                .background(Theme.Colors.tabItem.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

            Text(title)
                .font(.callout.weight(.bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            Text(detail)
                .font(.caption.weight(.medium))
                .foregroundStyle(.white.opacity(0.58))
                .multilineTextAlignment(.center)
                .lineLimit(3)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
        .background(Theme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Theme.Layout.cardRadius, style: .continuous)
                .stroke(.white.opacity(0.08), lineWidth: 1)
        }
    }
}

private struct ExactCertificationCardImage: View {
    let title: String
    var subtitle: String?
    let filename: String
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(title)
                    .font(.subheadline.weight(.black))
                    .foregroundStyle(accent)
                    .textCase(.uppercase)

                if let subtitle {
                    Text(subtitle)
                        .font(.caption.italic().weight(.semibold))
                        .foregroundStyle(accent)
                }
            }

            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .shadow(color: .black.opacity(0.34), radius: 8, y: 5)
            } else {
                Label("Sample card image missing", systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.Colors.warning)
                    .frame(maxWidth: .infinity, minHeight: 110)
                    .background(Theme.Colors.elevatedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            }
        }
    }

    private var image: UIImage? {
        guard let url = Bundle.main.url(forResource: filename, withExtension: nil, subdirectory: "Artwork") else {
            return nil
        }

        return UIImage(contentsOfFile: url.path)
    }
}
