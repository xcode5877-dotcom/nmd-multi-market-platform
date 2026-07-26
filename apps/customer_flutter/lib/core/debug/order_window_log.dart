/// Temporary production trace for order-editing-window navigation (release-visible).
void orderWindowLog(String message) {
  // ignore: avoid_print
  print(message);
}

/// Logs navigations that land on market home (`/market/:slug`).
void orderWindowLogHomeNavigation(String source, String target) {
  final segs = Uri.tryParse(target)?.pathSegments ?? [];
  if (segs.length == 2 && segs[0] == 'market') {
    orderWindowLog(
      '[ORDER_WINDOW] HOME NAVIGATION CALLED from $source target=$target',
    );
  }
}
