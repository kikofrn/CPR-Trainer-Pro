import SwiftUI
import UIKit

struct InteractiveTabContainer: View {
    @Binding var selection: AppTab
    @ObservedObject var appViewModel: AppViewModel

    @Environment(\.launchExperienceTrigger) private var launchExperienceTrigger
    @State private var headerProgressByTab: [AppTab: CGFloat] = [:]
    @State private var heartbeatTapTimes: [Date] = []
    @State private var isPagingTransitionInProgress = false

    var body: some View {
        ZStack(alignment: .topLeading) {
            InteractiveTabPager(
                selection: $selection,
                appViewModel: appViewModel,
                launchExperienceTrigger: launchExperienceTrigger,
                onHeaderProgressChange: recordHeaderProgress,
                onTransitionActivityChange: { isActive in
                    isPagingTransitionInProgress = isActive
                }
            )

            sharedBrandLogo
                .zIndex(1)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            MainTabBar(
                selection: $selection,
                isInteractionEnabled: !isPagingTransitionInProgress
            )
        }
    }

    private var sharedBrandLogo: some View {
        let progress = headerProgressByTab[selection] ?? 0
        let logoHeight = StickyBrandHeaderMetrics.logoHeight(for: progress)
        let headerHeight = StickyBrandHeaderMetrics.headerHeight(for: progress)

        return HStack(spacing: 0) {
            HeartbeatBrandHeader(
                logoHeight: logoHeight,
                alignment: .leading,
                onBeat: recordHeartbeatTap
            )
            .frame(
                width: logoHeight * StickyBrandHeaderMetrics.logoAspectRatio,
                alignment: .leading
            )
            .frame(minHeight: StickyBrandHeaderMetrics.minimumTapTargetHeight)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Layout.screenPadding)
        .frame(maxWidth: .infinity)
        .frame(height: headerHeight)
        .animation(.easeInOut(duration: 0.18), value: progress)
    }

    private func recordHeaderProgress(_ tab: AppTab, _ progress: CGFloat) {
        let clampedProgress = min(1, max(0, progress))
        guard abs((headerProgressByTab[tab] ?? 0) - clampedProgress) > 0.001 else {
            return
        }

        headerProgressByTab[tab] = clampedProgress
    }

    private func recordHeartbeatTap() {
        let now = Date()
        heartbeatTapTimes = (heartbeatTapTimes + [now])
            .filter { now.timeIntervalSince($0) <= 10 }

        guard heartbeatTapTimes.count >= 10 else {
            return
        }

        heartbeatTapTimes.removeAll()
        launchExperienceTrigger()
    }
}

private struct InteractiveTabPager: UIViewControllerRepresentable {
    @Binding var selection: AppTab
    @ObservedObject var appViewModel: AppViewModel

    let launchExperienceTrigger: () -> Void
    let onHeaderProgressChange: (AppTab, CGFloat) -> Void
    let onTransitionActivityChange: (Bool) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            selection: $selection,
            onHeaderProgressChange: onHeaderProgressChange,
            onTransitionActivityChange: onTransitionActivityChange
        )
    }

    func makeUIViewController(context: Context) -> InteractiveTabViewController {
        let tabs = AppTab.orderedTabs
        let pages = tabs.map {
            makeHostingController(for: $0, coordinator: context.coordinator)
        }
        let controller = InteractiveTabViewController(
            tabs: tabs,
            pages: pages,
            initialSelection: selection
        )

        context.coordinator.controller = controller
        controller.onSelectionChange = { [weak coordinator = context.coordinator] tab in
            coordinator?.didSelect(tab)
        }
        controller.onTransitionActivityChange = {
            [weak coordinator = context.coordinator] isActive in
            coordinator?.didChangeTransitionActivity(isActive)
        }

        return controller
    }

    func updateUIViewController(
        _ controller: InteractiveTabViewController,
        context: Context
    ) {
        context.coordinator.selection = $selection
        context.coordinator.onHeaderProgressChange = onHeaderProgressChange
        context.coordinator.onTransitionActivityChange = onTransitionActivityChange
        controller.select(selection, animated: false, notifiesSelection: false)
    }

    private func makeHostingController(
        for tab: AppTab,
        coordinator: Coordinator
    ) -> UIViewController {
        let content: AnyView
        let progressReporter: (CGFloat) -> Void = { [weak coordinator] progress in
            coordinator?.didChangeHeaderProgress(progress, for: tab)
        }

        switch tab {
        case .cprAED:
            content = AnyView(
                CoursesView(
                    courseID: .cprAED,
                    title: "CPR/AED",
                    showsBrandLogo: false,
                    onHeaderProgressChange: progressReporter
                )
            )
        case .firstAid:
            content = AnyView(
                CoursesView(
                    courseID: .firstAid,
                    title: "First Aid",
                    showsBrandLogo: false,
                    onHeaderProgressChange: progressReporter
                )
            )
        case .manuals:
            content = AnyView(
                ManualsView(
                    showsBrandLogo: false,
                    onHeaderProgressChange: progressReporter
                )
            )
        case .sendCerts:
            content = AnyView(
                SendCertsView(
                    showsBrandLogo: false,
                    onHeaderProgressChange: progressReporter
                )
            )
        case .settings:
            content = AnyView(
                SettingsView(
                    showsBrandLogo: false,
                    onHeaderProgressChange: progressReporter
                )
            )
        }

        let rootView = content
            .environmentObject(appViewModel)
            .environmentObject(appViewModel.downloadService)
            .environment(\.launchExperienceTrigger, launchExperienceTrigger)
            .tint(Theme.Colors.selectedTabItem)
            .preferredColorScheme(.dark)

        return UIHostingController(rootView: rootView)
    }

    @MainActor
    final class Coordinator {
        var selection: Binding<AppTab>
        var onHeaderProgressChange: (AppTab, CGFloat) -> Void
        var onTransitionActivityChange: (Bool) -> Void
        weak var controller: InteractiveTabViewController?

        init(
            selection: Binding<AppTab>,
            onHeaderProgressChange: @escaping (AppTab, CGFloat) -> Void,
            onTransitionActivityChange: @escaping (Bool) -> Void
        ) {
            self.selection = selection
            self.onHeaderProgressChange = onHeaderProgressChange
            self.onTransitionActivityChange = onTransitionActivityChange
        }

        func didSelect(_ tab: AppTab) {
            guard selection.wrappedValue != tab else { return }
            selection.wrappedValue = tab
        }

        func didChangeHeaderProgress(_ progress: CGFloat, for tab: AppTab) {
            onHeaderProgressChange(tab, progress)
        }

        func didChangeTransitionActivity(_ isActive: Bool) {
            onTransitionActivityChange(isActive)
        }
    }
}

@MainActor
final class InteractiveTabViewController: UIViewController {
    var onSelectionChange: ((AppTab) -> Void)?
    var onTransitionActivityChange: ((Bool) -> Void)?

    private let tabs: [AppTab]
    private let pages: [UIViewController]
    private let pageViewController: UIPageViewController

    private var currentIndex: Int
    private var pendingInteractiveIndex: Int?
    private var isProgrammaticTransitionInFlight = false

    init(
        tabs: [AppTab],
        pages: [UIViewController],
        initialSelection: AppTab
    ) {
        precondition(!tabs.isEmpty)
        precondition(tabs.count == pages.count)

        self.tabs = tabs
        self.pages = pages
        self.currentIndex = tabs.firstIndex(of: initialSelection) ?? 0
        self.pageViewController = UIPageViewController(
            transitionStyle: .scroll,
            navigationOrientation: .horizontal,
            options: [.interPageSpacing: 0]
        )

        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = UIColor(Theme.Colors.background)
        configurePageViewController()
        installLayout()
    }

    func select(
        _ tab: AppTab,
        animated: Bool,
        notifiesSelection: Bool
    ) {
        guard
            let targetIndex = tabs.firstIndex(of: tab),
            targetIndex != currentIndex,
            !isProgrammaticTransitionInFlight,
            pendingInteractiveIndex == nil
        else {
            return
        }

        transition(
            to: targetIndex,
            animated: animated,
            notifiesSelection: notifiesSelection
        )
    }

    private func configurePageViewController() {
        pageViewController.dataSource = self
        pageViewController.delegate = self
        pageViewController.view.backgroundColor = UIColor(Theme.Colors.background)
        pageViewController.setViewControllers(
            [pages[currentIndex]],
            direction: .forward,
            animated: false
        )

        if let pagingScrollView = pageViewController.view.subviews
            .compactMap({ $0 as? UIScrollView })
            .first
        {
            pagingScrollView.isDirectionalLockEnabled = true
            pagingScrollView.alwaysBounceVertical = false
        }
    }

    private func installLayout() {
        addChild(pageViewController)
        view.addSubview(pageViewController.view)

        pageViewController.view.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            pageViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            pageViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pageViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            pageViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        pageViewController.didMove(toParent: self)
    }

    private func transition(
        to targetIndex: Int,
        animated: Bool,
        notifiesSelection: Bool
    ) {
        let previousIndex = currentIndex
        let direction: UIPageViewController.NavigationDirection =
            targetIndex > previousIndex ? .forward : .reverse

        isProgrammaticTransitionInFlight = true
        setNavigationInteractionEnabled(false)
        onTransitionActivityChange?(true)

        pageViewController.setViewControllers(
            [pages[targetIndex]],
            direction: direction,
            animated: animated
        ) { [weak self] finished in
            guard let self else { return }

            let finalIndex: Int
            if
                finished,
                self.pageViewController.viewControllers?.first === self.pages[targetIndex]
            {
                finalIndex = targetIndex
            } else {
                finalIndex = self.index(
                    of: self.pageViewController.viewControllers?.first
                ) ?? previousIndex
            }

            self.finishTransition(
                at: finalIndex,
                notifiesSelection: notifiesSelection && finalIndex == targetIndex
            )
        }
    }

    private func finishTransition(
        at index: Int,
        notifiesSelection: Bool
    ) {
        currentIndex = index
        pendingInteractiveIndex = nil
        isProgrammaticTransitionInFlight = false
        setNavigationInteractionEnabled(true)
        onTransitionActivityChange?(false)

        if notifiesSelection {
            onSelectionChange?(tabs[index])
        }
    }

    private func setNavigationInteractionEnabled(_ isEnabled: Bool) {
        pageViewController.view.isUserInteractionEnabled = isEnabled
    }

    private func index(of controller: UIViewController?) -> Int? {
        guard let controller else { return nil }
        return pages.firstIndex { $0 === controller }
    }
}

extension InteractiveTabViewController: UIPageViewControllerDataSource {
    func pageViewController(
        _ pageViewController: UIPageViewController,
        viewControllerBefore viewController: UIViewController
    ) -> UIViewController? {
        guard
            let index = index(of: viewController),
            pages.indices.contains(index - 1)
        else {
            return nil
        }

        return pages[index - 1]
    }

    func pageViewController(
        _ pageViewController: UIPageViewController,
        viewControllerAfter viewController: UIViewController
    ) -> UIViewController? {
        guard
            let index = index(of: viewController),
            pages.indices.contains(index + 1)
        else {
            return nil
        }

        return pages[index + 1]
    }
}

extension InteractiveTabViewController: UIPageViewControllerDelegate {
    func pageViewController(
        _ pageViewController: UIPageViewController,
        willTransitionTo pendingViewControllers: [UIViewController]
    ) {
        pendingInteractiveIndex = index(of: pendingViewControllers.first)
        onTransitionActivityChange?(true)
    }

    func pageViewController(
        _ pageViewController: UIPageViewController,
        didFinishAnimating finished: Bool,
        previousViewControllers: [UIViewController],
        transitionCompleted completed: Bool
    ) {
        defer {
            pendingInteractiveIndex = nil
            onTransitionActivityChange?(false)
        }

        guard
            completed,
            let visibleIndex = index(of: pageViewController.viewControllers?.first)
        else {
            return
        }

        currentIndex = visibleIndex
        onSelectionChange?(tabs[visibleIndex])
    }
}

private struct MainTabBar: View {
    @Binding var selection: AppTab
    let isInteractionEnabled: Bool

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.orderedTabs, id: \.self) { tab in
                Button {
                    guard isInteractionEnabled else { return }
                    selection = tab
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.systemImageName)
                            .symbolRenderingMode(.monochrome)
                            .font(.system(size: 20, weight: .semibold))
                            .frame(height: 23)

                        Text(tab.tabTitle)
                            .font(.system(size: 10, weight: tab == selection ? .bold : .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                            .allowsTightening(true)
                    }
                    .foregroundStyle(
                        tab == selection
                            ? Theme.Colors.selectedTabItem
                            : Theme.Colors.tabItem
                    )
                    .frame(maxWidth: .infinity)
                    .frame(height: 58)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!isInteractionEnabled)
                .accessibilityLabel(tab.tabTitle)
                .accessibilityAddTraits(tab == selection ? .isSelected : [])
                .accessibilityIdentifier("main-tab-\(tab.accessibilityIdentifier)")
            }
        }
        .padding(.horizontal, 4)
        .frame(height: 58)
        .background {
            ZStack {
                Rectangle()
                    .fill(.ultraThinMaterial)
                Color(red: 0.78, green: 0.02, blue: 0.06)
                    .opacity(0.34)
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(height: 1)
        }
    }
}
