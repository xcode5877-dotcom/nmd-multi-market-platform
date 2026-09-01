/// Central, testable visibility policy for the floating Smart Support Hub.
///
/// Matching uses normalized path segments (not substring / contains).
abstract final class SupportRoutePolicy {
  /// Surfaces where the capsule aids discovery.
  static bool shouldShowFloatingSupport({
    required String path,
    bool keyboardVisible = false,
    bool modalRouteActive = false,
    bool supportConfigAllows = true,
  }) {
    return evaluate(
      path: path,
      keyboardVisible: keyboardVisible,
      modalRouteActive: modalRouteActive,
      supportConfigAllows: supportConfigAllows,
    ).visible;
  }

  /// Detailed decision for diagnostics / tests.
  static SupportVisibilityDecision evaluate({
    required String path,
    bool keyboardVisible = false,
    bool modalRouteActive = false,
    bool supportConfigAllows = true,
  }) {
    final normalized = normalizePath(path);
    if (!supportConfigAllows) {
      return SupportVisibilityDecision(
        visible: false,
        path: normalized,
        reason: 'config_disallows',
      );
    }
    if (keyboardVisible) {
      return SupportVisibilityDecision(
        visible: false,
        path: normalized,
        reason: 'keyboard_visible',
      );
    }
    if (modalRouteActive) {
      return SupportVisibilityDecision(
        visible: false,
        path: normalized,
        reason: 'modal_active',
      );
    }

    final segs = pathSegments(normalized);
    if (segs.isEmpty) {
      return SupportVisibilityDecision(
        visible: false,
        path: normalized,
        reason: 'empty_route',
      );
    }

    final first = segs.first;

    // Splash / market-picker only — never treat "main" as a substring hide.
    if (first == 'splash') {
      return SupportVisibilityDecision(
        visible: false,
        path: normalized,
        reason: 'splash',
      );
    }
    if (first == 'main' && segs.length == 1) {
      // Market selection picker — not the Home shell.
      return SupportVisibilityDecision(
        visible: false,
        path: normalized,
        reason: 'market_picker',
      );
    }

    // Production Home shell: /market/:slug[/...]
    if (first != 'market' || segs.length < 2) {
      return SupportVisibilityDecision(
        visible: false,
        path: normalized,
        reason: 'outside_market_shell',
      );
    }

    // Home only: /market/:slug (exactly two segments).
    if (segs.length == 2) {
      return SupportVisibilityDecision(
        visible: true,
        path: normalized,
        reason: 'allowed_home_route',
      );
    }

    return SupportVisibilityDecision(
      visible: false,
      path: normalized,
      reason: 'home_only',
    );
  }

  static String normalizePath(String path) {
    var p = path.trim();
    if (p.isEmpty) return '';
    final q = p.indexOf('?');
    if (q >= 0) p = p.substring(0, q);
    final h = p.indexOf('#');
    if (h >= 0) p = p.substring(0, h);
    if (!p.startsWith('/')) p = '/$p';
    while (p.length > 1 && p.endsWith('/')) {
      p = p.substring(0, p.length - 1);
    }
    return p;
  }

  static List<String> pathSegments(String path) {
    final normalized = normalizePath(path);
    if (normalized.isEmpty || normalized == '/') return const [];
    return normalized
        .split('/')
        .where((s) => s.isNotEmpty)
        .map((s) => s.toLowerCase())
        .toList(growable: false);
  }

  static String analyticsSourceForPath(String path) {
    final segs = pathSegments(path);
    if (segs.length < 2 || segs.first != 'market') return 'unknown';
    if (segs.length == 2) return 'home';
    final section = segs[2];
    switch (section) {
      case 'orders':
        return 'orders';
      case 'account':
        return 'account';
      case 'store':
        return 'store';
      case 'rewards':
        return 'rewards';
      case 'offers':
        return 'offers';
      default:
        return section;
    }
  }

  static String capsuleLabel({required bool hasOrderContext}) {
    if (hasOrderContext) return 'مساعدة بخصوص الطلب';
    return 'المساعدة';
  }

}

class SupportVisibilityDecision {
  const SupportVisibilityDecision({
    required this.visible,
    required this.path,
    required this.reason,
  });

  final bool visible;
  final String path;
  final String reason;
}
