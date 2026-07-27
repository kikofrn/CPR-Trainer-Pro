import SwiftUI
import UIKit

struct InteractiveTabContainer: UIViewControllerRepresentable {
    @Binding var selection: AppTab
    @ObservedObject var appViewModel: AppViewModel

    @Environment(\.launchExperienceTrigger) private var launchExperienceTrigger

    func makeCoordinator() -> Coordinator {
        Coordinator(selection: $selection)
    }

    func makeUIViewController(context: Context) -> InteractiveTabViewController {
        let tabs = AppTab.orderedTabs
        let pages = tabs.map(makeHostingController)
        let controller = InteractiveTabViewController(
            tabs: tabs,
            pages: pages,
            initialSelection: selection
        )

        context.coordinator.controller = controller
        controller.onSelectionChange = { [weak coordinator = context.coordinator] tab in
            coordinator?.didSelect(tab)
        }

        return controller
    }

    func updateUIViewController(
        _ controller: InteractiveTabViewController,
        context: Context
    ) {
        context.coordinator.selection = $selection
        controller.select(selection, animated: false, notifiesSelection: false)
    }

    private func makeHostingController(for tab: AppTab) -> UIViewController {
        let content: AnyView

        switch tab {
        case .cprAED:
            content = AnyView(CoursesView(courseID: .cprAED, title: "CPR/AED"))
        case .firstAid:
            content = AnyView(CoursesView(courseID: .firstAid, title: "First Aid"))
        case .manuals:
            content = AnyView(ManualsView())
        case .sendCerts:
            content = AnyView(SendCertsView())
        case .settings:
            content = AnyView(SettingsView())
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
        weak var controller: InteractiveTabViewController?

        init(selection: Binding<AppTab>) {
            self.selection = selection
        }

        func didSelect(_ tab: AppTab) {
            guard selection.wrappedValue != tab else { return }
            selection.wrappedValue = tab
        }
    }
}

@MainActor
final class InteractiveTabViewController: UIViewController {
    var onSelectionChange: ((AppTab) -> Void)?

    private let tabs: [AppTab]
    private let pages: [UIViewController]
    private let pageViewController: UIPageViewController
    private let tabBar = UITabBar()
    private let tabBarBaseHeight: CGFloat = 49

    private var tabBarHeightConstraint: NSLayoutConstraint?
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
        configureTabBar()
        installLayout()
        synchronizeTabBarSelection()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateTabBarHeight()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        updateTabBarHeight()
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
            synchronizeTabBarSelection()
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

    private func configureTabBar() {
        tabBar.delegate = self
        tabBar.itemPositioning = .fill
        tabBar.items = tabs.enumerated().map { index, tab in
            let item = UITabBarItem(
                title: tab.tabTitle,
                image: UIImage(systemName: tab.systemImageName),
                tag: index
            )
            item.accessibilityIdentifier = "main-tab-\(tab.accessibilityIdentifier)"
            return item
        }
    }

    private func installLayout() {
        addChild(pageViewController)
        view.addSubview(pageViewController.view)
        view.addSubview(tabBar)

        pageViewController.view.translatesAutoresizingMaskIntoConstraints = false
        tabBar.translatesAutoresizingMaskIntoConstraints = false

        let tabBarHeightConstraint = tabBar.heightAnchor.constraint(
            equalToConstant: tabBarBaseHeight
        )
        self.tabBarHeightConstraint = tabBarHeightConstraint

        NSLayoutConstraint.activate([
            pageViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            pageViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pageViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            pageViewController.view.bottomAnchor.constraint(equalTo: tabBar.topAnchor),

            tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            tabBarHeightConstraint
        ])

        pageViewController.didMove(toParent: self)
    }

    private func updateTabBarHeight() {
        let requiredHeight = tabBarBaseHeight + view.safeAreaInsets.bottom

        if tabBarHeightConstraint?.constant != requiredHeight {
            tabBarHeightConstraint?.constant = requiredHeight
        }
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
        tabBar.selectedItem = tabBar.items?[targetIndex]

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
        synchronizeTabBarSelection()

        if notifiesSelection {
            onSelectionChange?(tabs[index])
        }
    }

    private func setNavigationInteractionEnabled(_ isEnabled: Bool) {
        pageViewController.view.isUserInteractionEnabled = isEnabled
        tabBar.isUserInteractionEnabled = isEnabled
    }

    private func synchronizeTabBarSelection() {
        guard
            isViewLoaded,
            tabBar.items?.indices.contains(currentIndex) == true
        else {
            return
        }

        tabBar.selectedItem = tabBar.items?[currentIndex]
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
        tabBar.isUserInteractionEnabled = false
    }

    func pageViewController(
        _ pageViewController: UIPageViewController,
        didFinishAnimating finished: Bool,
        previousViewControllers: [UIViewController],
        transitionCompleted completed: Bool
    ) {
        defer {
            pendingInteractiveIndex = nil
            tabBar.isUserInteractionEnabled = true
        }

        guard
            completed,
            let visibleIndex = index(of: pageViewController.viewControllers?.first)
        else {
            synchronizeTabBarSelection()
            return
        }

        currentIndex = visibleIndex
        synchronizeTabBarSelection()
        onSelectionChange?(tabs[visibleIndex])
    }
}

extension InteractiveTabViewController: UITabBarDelegate {
    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard
            tabs.indices.contains(item.tag),
            item.tag != currentIndex
        else {
            synchronizeTabBarSelection()
            return
        }

        transition(
            to: item.tag,
            animated: true,
            notifiesSelection: true
        )
    }
}
