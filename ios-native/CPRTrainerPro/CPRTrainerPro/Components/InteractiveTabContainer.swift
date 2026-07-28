import SwiftUI
import UIKit

struct InteractiveTabContainer: View {
    @Binding var selection: AppTab
    @ObservedObject var appViewModel: AppViewModel

    @Environment(\.launchExperienceTrigger) private var launchExperienceTrigger
    @State private var headerProgressByTab: [AppTab: CGFloat] = [:]
    @State private var heartbeatTapTimes: [Date] = []
    @State private var tabRequestSequence = 0
    @State private var tabSelectionRequest: TabSelectionRequest?

    var body: some View {
        ZStack(alignment: .topLeading) {
            InteractiveTabPager(
                selection: $selection,
                selectionRequest: tabSelectionRequest,
                appViewModel: appViewModel,
                launchExperienceTrigger: launchExperienceTrigger,
                onHeaderProgressChange: recordHeaderProgress,
                onTransitionActivityChange: { _ in },
                onSelectionRequestConsumed: consumeTabSelectionRequest
            )

            sharedBrandLogo
                .zIndex(1)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            MainTabBar(
                selection: selection,
                onSelectionRequest: requestTabSelection
            )
        }
    }

    private func requestTabSelection(_ tab: AppTab) {
        tabRequestSequence &+= 1
        tabSelectionRequest = TabSelectionRequest(
            sequence: tabRequestSequence,
            tab: tab
        )
    }

    private func consumeTabSelectionRequest(_ sequence: Int) {
        guard tabSelectionRequest?.sequence == sequence else { return }
        tabSelectionRequest = nil
    }

    private var sharedBrandLogo: some View {
        let progress = headerProgressByTab[selection] ?? 0
        let logoHeight = StickyBrandHeaderMetrics.logoHeight(for: progress) * 1.04
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
        .padding(.trailing, Theme.Layout.screenPadding)
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

private struct TabSelectionRequest: Equatable {
    let sequence: Int
    let tab: AppTab
}

private struct InteractiveTabPager: UIViewControllerRepresentable {
    @Binding var selection: AppTab
    let selectionRequest: TabSelectionRequest?
    @ObservedObject var appViewModel: AppViewModel

    let launchExperienceTrigger: () -> Void
    let onHeaderProgressChange: (AppTab, CGFloat) -> Void
    let onTransitionActivityChange: (Bool) -> Void
    let onSelectionRequestConsumed: (Int) -> Void

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
        if let selectionRequest {
            controller.requestSelection(
                selectionRequest.tab,
                requestSequence: selectionRequest.sequence
            )
            let sequence = selectionRequest.sequence
            DispatchQueue.main.async {
                onSelectionRequestConsumed(sequence)
            }
        } else {
            controller.reconcileVisiblePageIfIdle()
        }
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

struct TabPagerStateMachine: Equatable {
    private(set) var currentIndex: Int
    private(set) var interactiveDestination: Int?
    private(set) var queuedRequestedIndex: Int?
    private(set) var programmaticTransitionID: Int?
    private var nextProgrammaticTransitionID = 0

    init(currentIndex: Int) {
        self.currentIndex = currentIndex
    }

    var hasTransitionInFlight: Bool {
        programmaticTransitionID != nil || interactiveDestination != nil
    }

    mutating func queueRequest(_ index: Int) {
        queuedRequestedIndex = index
    }

    mutating func beginProgrammaticTransition(to index: Int) -> Int {
        nextProgrammaticTransitionID &+= 1
        programmaticTransitionID = nextProgrammaticTransitionID
        return nextProgrammaticTransitionID
    }

    @discardableResult
    mutating func finishProgrammaticTransition(
        id: Int,
        visibleIndex: Int
    ) -> Bool {
        guard programmaticTransitionID == id else { return false }
        programmaticTransitionID = nil
        return commitVisibleIndex(visibleIndex)
    }

    mutating func beginInteractiveTransition(to index: Int?) {
        // An interactive gesture owns the visible transition from this point.
        // Clearing the programmatic marker prevents a stale completion from
        // stranding the pager in a permanently busy state.
        programmaticTransitionID = nil
        interactiveDestination = index
    }

    @discardableResult
    mutating func finishInteractiveTransition(visibleIndex: Int) -> Bool {
        interactiveDestination = nil
        return commitVisibleIndex(visibleIndex)
    }

    @discardableResult
    mutating func recoverAtIdle(visibleIndex: Int) -> Bool {
        programmaticTransitionID = nil
        interactiveDestination = nil
        return commitVisibleIndex(visibleIndex)
    }

    mutating func takeQueuedRequest() -> Int? {
        defer { queuedRequestedIndex = nil }
        return queuedRequestedIndex
    }

    @discardableResult
    mutating func commitVisibleIndex(_ index: Int) -> Bool {
        guard currentIndex != index else { return false }
        currentIndex = index
        return true
    }
}

@MainActor
final class InteractiveTabViewController: UIViewController {
    var onSelectionChange: ((AppTab) -> Void)?
    var onTransitionActivityChange: ((Bool) -> Void)?

    private let tabs: [AppTab]
    private let pages: [UIViewController]
    private let pageViewController: UIPageViewController

    private var transitionState: TabPagerStateMachine
    private var lastHandledRequestSequence = 0
    private weak var pagingScrollView: UIScrollView?
    private var recoveryTask: Task<Void, Never>?
    private var foregroundObserver: NSObjectProtocol?

    init(
        tabs: [AppTab],
        pages: [UIViewController],
        initialSelection: AppTab
    ) {
        precondition(!tabs.isEmpty)
        precondition(tabs.count == pages.count)

        self.tabs = tabs
        self.pages = pages
        self.transitionState = TabPagerStateMachine(
            currentIndex: tabs.firstIndex(of: initialSelection) ?? 0
        )
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
        foregroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.reconcileVisiblePageIfIdle()
            }
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        reconcileVisiblePageIfIdle()
    }

    deinit {
        recoveryTask?.cancel()
        foregroundObserver.map(NotificationCenter.default.removeObserver)
    }

    func requestSelection(_ tab: AppTab, requestSequence: Int) {
        guard requestSequence > lastHandledRequestSequence else { return }
        lastHandledRequestSequence = requestSequence
        guard let targetIndex = tabs.firstIndex(of: tab) else { return }

        if isPagingBusy {
            transitionState.queueRequest(targetIndex)
            scheduleRecovery()
            return
        }

        guard targetIndex != transitionState.currentIndex else { return }
        transition(to: targetIndex)
    }

    func reconcileVisiblePageIfIdle() {
        guard !isPagingBusy else { return }
        commitVisiblePage()
    }

    private func configurePageViewController() {
        pageViewController.dataSource = self
        pageViewController.delegate = self
        pageViewController.view.backgroundColor = UIColor(Theme.Colors.background)
        pageViewController.setViewControllers(
            [pages[transitionState.currentIndex]],
            direction: .forward,
            animated: false
        )

        if let pagingScrollView = pageViewController.view.subviews
            .compactMap({ $0 as? UIScrollView })
            .first
        {
            self.pagingScrollView = pagingScrollView
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

    private func transition(to targetIndex: Int) {
        guard !isPagingBusy, targetIndex != transitionState.currentIndex else {
            transitionState.queueRequest(targetIndex)
            scheduleRecovery()
            return
        }

        let previousIndex = transitionState.currentIndex
        let direction: UIPageViewController.NavigationDirection =
            targetIndex > previousIndex ? .forward : .reverse

        let transitionID = transitionState.beginProgrammaticTransition(to: targetIndex)
        onTransitionActivityChange?(true)
        scheduleRecovery()

        pageViewController.setViewControllers(
            [pages[targetIndex]],
            direction: direction,
            animated: false
        ) { [weak self] _ in
            guard let self else { return }
            let visibleIndex = self.index(
                of: self.pageViewController.viewControllers?.first
            ) ?? previousIndex
            guard self.transitionState.finishProgrammaticTransition(
                id: transitionID,
                visibleIndex: visibleIndex
            ) else {
                self.scheduleRecovery()
                return
            }
            self.publishCommittedSelectionIfNeeded()
            self.finishTransitionCycle()
        }
    }

    private var isPagingBusy: Bool {
        transitionState.hasTransitionInFlight
            || pagingScrollView?.isTracking == true
            || pagingScrollView?.isDragging == true
            || pagingScrollView?.isDecelerating == true
    }

    private func commitVisiblePage(fallbackIndex: Int? = nil) {
        let visibleIndex = index(of: pageViewController.viewControllers?.first)
            ?? fallbackIndex
            ?? transitionState.currentIndex
        guard pages.indices.contains(visibleIndex) else { return }
        guard transitionState.commitVisibleIndex(visibleIndex) else { return }
        publishCommittedSelectionIfNeeded()
    }

    private func publishCommittedSelectionIfNeeded() {
        let selectedTab = tabs[transitionState.currentIndex]
        DispatchQueue.main.async { [weak self] in
            self?.onSelectionChange?(selectedTab)
        }
    }

    private func finishTransitionCycle() {
        guard !isPagingBusy else {
            scheduleRecovery()
            return
        }

        onTransitionActivityChange?(false)
        applyQueuedRequestIfPossible()
    }

    private func applyQueuedRequestIfPossible() {
        guard let targetIndex = transitionState.takeQueuedRequest() else { return }
        guard targetIndex != transitionState.currentIndex else { return }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if self.isPagingBusy {
                self.transitionState.queueRequest(targetIndex)
                self.scheduleRecovery()
            } else {
                self.transition(to: targetIndex)
            }
        }
    }

    private func scheduleRecovery() {
        recoveryTask?.cancel()
        recoveryTask = Task { @MainActor [weak self] in
            for _ in 0..<80 {
                try? await Task.sleep(nanoseconds: 50_000_000)
                guard !Task.isCancelled, let self else { return }
                guard self.pagingScrollView?.isTracking != true,
                      self.pagingScrollView?.isDragging != true,
                      self.pagingScrollView?.isDecelerating != true
                else {
                    continue
                }

                let visibleIndex = self.index(
                    of: self.pageViewController.viewControllers?.first
                ) ?? self.transitionState.currentIndex
                let changed = self.transitionState.recoverAtIdle(
                    visibleIndex: visibleIndex
                )
                if changed {
                    self.publishCommittedSelectionIfNeeded()
                }
                self.finishTransitionCycle()
                return
            }
        }
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
        transitionState.beginInteractiveTransition(
            to: index(of: pendingViewControllers.first)
        )
        onTransitionActivityChange?(true)
        scheduleRecovery()
    }

    func pageViewController(
        _ pageViewController: UIPageViewController,
        didFinishAnimating finished: Bool,
        previousViewControllers: [UIViewController],
        transitionCompleted completed: Bool
    ) {
        recoveryTask?.cancel()
        let visibleIndex = index(of: pageViewController.viewControllers?.first)
            ?? transitionState.currentIndex
        if transitionState.finishInteractiveTransition(
            visibleIndex: visibleIndex
        ) {
            publishCommittedSelectionIfNeeded()
        }
        finishTransitionCycle()
    }
}

private struct MainTabBar: View {
    let selection: AppTab
    let onSelectionRequest: (AppTab) -> Void
    @ScaledMetric(relativeTo: .body) private var iconSize = 20
    @ScaledMetric(relativeTo: .caption2) private var labelSize = 10

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(AppTab.orderedTabs.enumerated()), id: \.element) { index, tab in
                Button {
                    onSelectionRequest(tab)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.systemImageName)
                            .symbolRenderingMode(.monochrome)
                            .font(
                                .system(
                                    size: min(25, max(18, iconSize)),
                                    weight: .semibold
                                )
                            )
                            .frame(height: 23)

                        Text(tab.tabTitle)
                            .font(
                                .system(
                                    size: min(13, max(10, labelSize)),
                                    weight: tab == selection ? .bold : .semibold
                                )
                            )
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
                .accessibilityLabel(tab.tabTitle)
                .accessibilityValue("tab \(index + 1) of \(AppTab.orderedTabs.count)")
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
