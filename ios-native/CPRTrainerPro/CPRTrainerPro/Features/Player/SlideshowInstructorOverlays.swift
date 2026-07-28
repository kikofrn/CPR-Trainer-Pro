import SwiftUI

struct InstructorTipsToggleButton: View {
    let isPresented: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label("Tips", systemImage: isPresented ? "lightbulb.fill" : "lightbulb")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(isPresented ? .black : Theme.Colors.peach)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(isPresented ? Theme.Colors.peach : Theme.Colors.elevatedSurface)
                .clipShape(Capsule())
                .overlay {
                    Capsule()
                        .stroke(Theme.Colors.peach.opacity(isPresented ? 0 : 0.34), lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isPresented ? "Hide instructor tips" : "Show instructor tips")
    }
}

struct InstructorTipsPanel: View {
    let tip: InstructorSlideTip
    let close: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "lightbulb.fill")
                    .foregroundStyle(Theme.Colors.peach)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Instructor Tips")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)

                    Text("Slide \(tip.slideNumber): \(tip.title)")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.66))
                        .lineLimit(2)
                }

                Spacer()

                Button(action: close) {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(.white.opacity(0.10))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Hide instructor tips")
            }

            ScrollView {
                Text(tip.body)
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.86))
                    .lineSpacing(4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
            .frame(maxHeight: 280)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .background(Theme.Colors.surface.opacity(0.94))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(.white.opacity(0.12), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.36), radius: 22, y: 10)
    }
}

struct SlidePickerPanel: View {
    let slideshow: Slideshow
    let selectedIndex: Int
    let selectSlide: (Int) -> Void
    let close: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                Image(systemName: "rectangle.stack.fill")
                    .foregroundStyle(Theme.Colors.peach)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Choose Slide")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)

                    Text(slideshow.title)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.66))
                        .lineLimit(1)
                }

                Spacer()

                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(.white.opacity(0.10))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close slide chooser")
            }

            ScrollViewReader { reader in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(slideshow.slides.enumerated()), id: \.element.id) { index, slide in
                            Button {
                                selectSlide(index)
                            } label: {
                                HStack(spacing: 12) {
                                    Text("\(index + 1)")
                                        .font(.subheadline.monospacedDigit().weight(.bold))
                                        .foregroundStyle(index == selectedIndex ? .black : Theme.Colors.peach)
                                        .frame(width: 44, height: 44)
                                        .background(index == selectedIndex ? Theme.Colors.peach : .white.opacity(0.08))
                                        .clipShape(Circle())

                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(slide.title)
                                            .font(.body.weight(.semibold))
                                            .foregroundStyle(.white)
                                            .lineLimit(2)

                                        Text(slide.type == .video ? "Video slide" : "Image slide")
                                            .font(.caption)
                                            .foregroundStyle(.white.opacity(0.52))
                                    }

                                    Spacer()

                                    if index == selectedIndex {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(Theme.Colors.success)
                                    }
                                }
                                .padding(.vertical, 12)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .id(index)

                            if index < slideshow.slides.count - 1 {
                                Divider()
                                    .overlay(.white.opacity(0.12))
                            }
                        }
                    }
                }
                .frame(maxHeight: 360)
                .onAppear {
                    reader.scrollTo(selectedIndex, anchor: .center)
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .background(Theme.Colors.surface.opacity(0.96))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(.white.opacity(0.12), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.36), radius: 22, y: 10)
    }
}
