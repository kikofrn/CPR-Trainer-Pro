import SwiftUI

struct ManualNavigationPanel: View {
    @ObservedObject var viewModel: ManualViewerViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Manual navigation", selection: $viewModel.selectedNavigationTab) {
                    ForEach(ManualNavigationTab.allCases) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 18)
                .padding(.top, 14)
                .padding(.bottom, 10)

                Divider()
                    .overlay(.white.opacity(0.08))

                Group {
                    switch viewModel.selectedNavigationTab {
                    case .contents:
                        contentsTab
                    case .search:
                        searchTab
                    case .pages:
                        pagesTab
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(Color.black)
            .navigationTitle(viewModel.manual.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundStyle(Theme.Colors.peach)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var contentsTab: some View {
        Group {
            if viewModel.tocEntries.isEmpty {
                emptyState(
                    systemImage: "list.bullet.rectangle",
                    title: "Contents unavailable",
                    message: "This manual does not include usable bookmarks yet. Use Pages to jump around."
                )
            } else {
                List {
                    Section {
                        ForEach(viewModel.tocEntries) { entry in
                            navigationRow(
                                entry: entry,
                                subtitle: "Page \(entry.pageNumber)",
                                leadingSystemImage: "bookmark.fill"
                            )
                        }
                    } header: {
                        Text(viewModel.tocSource.label)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
    }

    private var searchTab: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.white.opacity(0.52))

                TextField("Search manual", text: Binding(
                    get: { viewModel.searchQuery },
                    set: { viewModel.updateSearchQuery($0) }
                ))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .foregroundStyle(.white)

                if !viewModel.searchQuery.isEmpty {
                    Button {
                        viewModel.updateSearchQuery("")
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.white.opacity(0.58))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Theme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .padding(.bottom, 8)

            if let statusText = viewModel.searchState.statusText {
                Text(statusText)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.Colors.peach)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 18)
                    .padding(.bottom, 8)
            }

            searchResultsContent
        }
    }

    @ViewBuilder
    private var searchResultsContent: some View {
        let trimmedQuery = viewModel.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmedQuery.isEmpty {
            emptyState(
                systemImage: "text.magnifyingglass",
                title: "Search This Manual",
                message: "Type a term to find the pages where it appears."
            )
        } else if viewModel.searchState == .indexing {
            emptyState(
                systemImage: "hourglass",
                title: "Preparing search",
                message: "The manual is being indexed. Results will appear here when ready."
            )
        } else if viewModel.searchResults.isEmpty {
            emptyState(
                systemImage: "magnifyingglass",
                title: "No results",
                message: "No results for \"\(trimmedQuery)\"."
            )
        } else {
            List(viewModel.searchResults) { result in
                Button {
                    jumpAndDismiss(result.pageIndex)
                } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text("Page \(result.pageNumber)")
                                .font(.headline.weight(.semibold))
                            Spacer()
                            Text(result.matchCount == 1 ? "1 match" : "\(result.matchCount) matches")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.Colors.peach)
                        }

                        Text(result.snippet)
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.68))
                            .lineLimit(3)
                    }
                    .padding(.vertical, 6)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .listRowBackground(Theme.Colors.surface)
                .foregroundStyle(.white)
            }
            .scrollContentBackground(.hidden)
        }
    }

    private var pagesTab: some View {
        Group {
            if viewModel.pageEntries.isEmpty {
                emptyState(
                    systemImage: "doc.plaintext",
                    title: "Pages unavailable",
                    message: "This PDF did not report a page count."
                )
            } else {
                List(viewModel.pageEntries) { entry in
                    navigationRow(
                        entry: entry,
                        subtitle: entry.pageIndex == viewModel.currentPageIndex ? "Current page" : nil,
                        leadingSystemImage: "doc.text"
                    )
                }
                .scrollContentBackground(.hidden)
            }
        }
    }

    private func navigationRow(entry: ManualTOCEntry, subtitle: String?, leadingSystemImage: String) -> some View {
        Button {
            jumpAndDismiss(entry.pageIndex)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: leadingSystemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.Colors.peach)
                    .frame(width: 24)
                    .opacity(entry.level > 0 ? 0.72 : 1)

                VStack(alignment: .leading, spacing: 3) {
                    Text(entry.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.white)
                        .lineLimit(2)

                    if let subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.56))
                    }
                }

                Spacer(minLength: 8)

                Text("\(entry.pageNumber)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.62))

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.42))
            }
            .padding(.leading, CGFloat(entry.level) * 18)
            .padding(.vertical, 5)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(Theme.Colors.surface)
        .accessibilityLabel("\(entry.title), page \(entry.pageNumber)")
    }

    private func emptyState(systemImage: String, title: String, message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(Theme.Colors.peach)

            Text(title)
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white)

            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.62))
                .padding(.horizontal, 28)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }

    private func jumpAndDismiss(_ pageIndex: Int) {
        viewModel.jumpToPage(pageIndex)
        dismiss()
    }
}
