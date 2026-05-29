import SwiftUI

struct SendCertsView: View {
    @Environment(\.openURL) private var openURL
    @State private var showsCertificationDetails = false

    var body: some View {
        NavigationStack {
            StickyBrandScrollView(title: "Send Certs") {
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

            SampleCertificationCard(
                title: "CPR AED & First Aid for All Ages",
                leftTitle: "CPR\nAED\nFirst Aid",
                sampleTitle: "Sample Card",
                name: "Ashley Carrero",
                instructorNumber: "AC-9593NC",
                phone: "4692989593",
                cardNumber: "EH-26562270390102",
                accent: Theme.Colors.blue
            )

            SampleCertificationCard(
                title: "Pediatric Specific",
                subtitle: "Perfect for Childcare Facilities",
                leftTitle: "Pediatric\nCPR\nFirst Aid",
                sampleTitle: "Sample Pediatric Cert.",
                name: "Mann Equinn",
                instructorNumber: "ME-1234",
                phone: "(972) 362-9113",
                cardNumber: "0987654321",
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

private struct SampleCertificationCard: View {
    let title: String
    var subtitle: String?
    let leftTitle: String
    let sampleTitle: String
    let name: String
    let instructorNumber: String
    let phone: String
    let cardNumber: String
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

            HStack(spacing: 0) {
                VStack(spacing: 10) {
                    Text(leftTitle)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)

                    Image(systemName: "heart.circle")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(.white)
                }
                .frame(width: 82)
                .frame(maxHeight: .infinity)
                .background(Color(red: 0.25, green: 0.29, blue: 0.50))

                VStack(alignment: .leading, spacing: 5) {
                    Text(sampleTitle)
                        .font(.headline.weight(.medium))
                        .foregroundStyle(.black)
                    Divider()
                    certificationRow("Issue Date", "5/15/2026")
                    certificationRow("Expiration Date", "5/15/2028")
                    checkRow("AED")
                    checkRow("Adult CPR")
                    checkRow("Child CPR")
                    checkRow("First Aid")
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white)

                VStack(alignment: .leading, spacing: 5) {
                    certificationRow("Instructor Name", name)
                    certificationRow("Instructor Number", instructorNumber)
                    certificationRow("Instructor Phone", phone)
                    certificationRow("Digital Card Number", cardNumber)
                    Spacer(minLength: 2)
                    Text("www.EHAcademy.com")
                        .font(.system(size: 7, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                        .background(Color(red: 0.25, green: 0.29, blue: 0.50))
                }
                .padding(8)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(Color(red: 0.94, green: 0.95, blue: 0.98))
            }
            .frame(height: 112)
            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            .shadow(color: .black.opacity(0.34), radius: 8, y: 5)
        }
    }

    private func certificationRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 6, weight: .bold))
                .foregroundStyle(.black.opacity(0.62))
            Text(value)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.black)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
    }

    private func checkRow(_ label: String) -> some View {
        HStack(spacing: 3) {
            Text(label)
                .font(.system(size: 7, weight: .bold))
                .foregroundStyle(.black)
            Image(systemName: "checkmark.square")
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(Color(red: 0.12, green: 0.18, blue: 0.36))
        }
    }
}
