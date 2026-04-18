import UIKit
import Capacitor

/**
 Pixel-perfect top layout: WKWebView must not add automatic safe-area padding (duplicates CSS `var(--sat)` / `env(safe-area-inset-top)`).
 */
@objc(AppBridgeViewController)
final class AppBridgeViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        applyWebViewScrollInsets()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // `webView` is guaranteed after bridge load; re-apply in case Capacitor reconfigures scroll view.
        applyWebViewScrollInsets()
    }

    private func applyWebViewScrollInsets() {
        guard let scroll = webView?.scrollView else { return }
        if #available(iOS 11.0, *) {
            scroll.contentInsetAdjustmentBehavior = .never
        }
        if #available(iOS 13.0, *) {
            scroll.automaticallyAdjustsScrollIndicatorInsets = false
        }
        scroll.contentInset = .zero
        scroll.scrollIndicatorInsets = .zero
        // Match Android overscroll: no rubber-band / white-gap pull at scroll edges
        scroll.bounces = false
    }
}
