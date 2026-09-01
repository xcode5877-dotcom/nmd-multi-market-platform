import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/support/support_analytics.dart';
import '../../../../core/support/support_config.dart';
import '../../../../core/support/support_config_repository.dart';
import '../../../../core/support/support_hub_chrome.dart';
import '../../../../core/support/support_route_policy.dart';
import '../../../../design_system/design_system.dart';
import '../../../../widgets/nmd_bottom_nav.dart';
import 'support_floating_capsule.dart';
import 'support_hub_sheet.dart';

/// Global Smart Support Hub overlay — single mount via [MaterialApp.builder].
///
/// IMPORTANT: [MaterialApp.router] builder context sits *above* [InheritedGoRouter].
/// Never use [GoRouter.of] / [GoRouterState.of] from that context — path is empty
/// and the capsule stays permanently hidden. Always pass the production [GoRouter].
///
/// Also never listen via [AnimatedBuilder] on [GoRouter.routerDelegate] from this
/// parent — the delegate notifies while the Router child is still mounting, which
/// marks this host dirty mid-build. Use deferred post-frame [setState] instead.
class SupportFloatingHubHost extends StatefulWidget {
  const SupportFloatingHubHost({
    super.key,
    required this.child,
    required this.modalDepth,
    required this.router,
  });

  final Widget child;
  final ValueNotifier<int> modalDepth;
  final GoRouter router;

  @override
  State<SupportFloatingHubHost> createState() => _SupportFloatingHubHostState();
}

class _SupportFloatingHubHostState extends State<SupportFloatingHubHost>
    with WidgetsBindingObserver {
  SupportConfig? _config;
  String? _impressedPath;
  bool _sheetOpen = false;
  String _path = '';
  bool _rebuildScheduled = false;

  GoRouter get _router => widget.router;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _config =
        SupportConfigRepository.peekSharedCache() ?? SupportConfig.safeDefault;
    _path = _readPath();
    _router.routerDelegate.addListener(_scheduleRebuild);
    widget.modalDepth.addListener(_scheduleRebuild);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _syncPathAndRebuild();
      _refreshConfig();
    });
  }

  @override
  void didUpdateWidget(covariant SupportFloatingHubHost oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.router != widget.router) {
      oldWidget.router.routerDelegate.removeListener(_scheduleRebuild);
      widget.router.routerDelegate.addListener(_scheduleRebuild);
    }
    if (oldWidget.modalDepth != widget.modalDepth) {
      oldWidget.modalDepth.removeListener(_scheduleRebuild);
      widget.modalDepth.addListener(_scheduleRebuild);
    }
  }

  @override
  void dispose() {
    _router.routerDelegate.removeListener(_scheduleRebuild);
    widget.modalDepth.removeListener(_scheduleRebuild);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshConfig();
    }
  }

  void _scheduleRebuild() {
    if (_rebuildScheduled) return;
    _rebuildScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _rebuildScheduled = false;
      if (!mounted) return;
      _syncPathAndRebuild();
    });
  }

  void _syncPathAndRebuild() {
    final next = _readPath();
    final pathChanged = next != _path;
    if (pathChanged) {
      _path = next;
      _refreshConfig();
    }
    setState(() {});
  }

  String _readPath() {
    try {
      final fromDelegate =
          _router.routerDelegate.currentConfiguration.uri.path;
      if (fromDelegate.trim().isNotEmpty) {
        return SupportRoutePolicy.normalizePath(fromDelegate);
      }
    } catch (_) {}
    try {
      final fromState = _router.state.uri.path;
      if (fromState.trim().isNotEmpty) {
        return SupportRoutePolicy.normalizePath(fromState);
      }
    } catch (_) {}
    try {
      final fromProvider = _router.routeInformationProvider.value.uri.path;
      if (fromProvider.trim().isNotEmpty) {
        return SupportRoutePolicy.normalizePath(fromProvider);
      }
    } catch (_) {}
    return '';
  }

  Future<void> _refreshConfig({bool force = false}) async {
    if (!mounted) return;
    try {
      final dio = context.read<Dio>();
      final config = await SupportConfigRepository(dio).fetch(force: force);
      if (!mounted) return;
      setState(() => _config = config);
    } catch (_) {
      if (!mounted) return;
      setState(() => _config ??= SupportConfig.safeDefault);
    }
  }

  void _maybeTrackImpression(String path, bool visible) {
    if (!visible) return;
    if (_impressedPath == path) return;
    _impressedPath = path;
    final dio = context.read<Dio>();
    // ignore: unawaited_futures
    trackSupportEvent(
      dio,
      SupportAnalyticsEvents.floatingImpression,
      source: SupportRoutePolicy.analyticsSourceForPath(path),
      hasOrderContext: false,
    );
  }

  Future<void> _openHub(SupportConfig config, String path) async {
    if (_sheetOpen) return;
    final navContext = SupportHubChrome.navigatorContext;
    if (navContext == null) return;
    _sheetOpen = true;
    if (mounted) setState(() {});
    try {
      await showSupportHubSheet(
        navContext,
        config: config,
        analyticsSource: SupportRoutePolicy.analyticsSourceForPath(path),
      );
      await _refreshConfig(force: true);
    } finally {
      _sheetOpen = false;
      if (mounted) setState(() {});
    }
  }

  void _logDecision(SupportVisibilityDecision d, SupportConfig config) {
    if (!kDebugMode) return;
    debugPrint(
      'SupportHubVisibility: '
      'route=${d.path} '
      'supportEnabled=${config.supportEnabled} '
      'floatingEnabled=${config.floatingSupportEnabled} '
      'phone=${config.phoneEnabled} '
      'whatsapp=${config.whatsappEnabled} '
      'keyboard=${MediaQuery.viewInsetsOf(context).bottom > 0} '
      'modalDepth=${widget.modalDepth.value} '
      'visible=${d.visible} '
      'reason=${d.reason}',
    );
  }

  @override
  Widget build(BuildContext context) {
    // Prefer the last synced path; fall back to a live read for the first frame.
    final path = _path.isNotEmpty ? _path : _readPath();
    final keyboardVisible = MediaQuery.viewInsetsOf(context).bottom > 0;
    final modalActive = widget.modalDepth.value > 0 || _sheetOpen;
    final config = _config ?? SupportConfig.safeDefault;
    final decision = SupportRoutePolicy.evaluate(
      path: path,
      keyboardVisible: keyboardVisible,
      modalRouteActive: modalActive,
      supportConfigAllows: config.showFloatingCapsule,
    );
    _logDecision(decision, config);

    if (decision.visible) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _maybeTrackImpression(path, true);
      });
    } else if (_impressedPath != null &&
        !SupportRoutePolicy.shouldShowFloatingSupport(
          path: path,
          supportConfigAllows: true,
        )) {
      _impressedPath = null;
    }

    final bottomPad = MediaQuery.paddingOf(context).bottom +
        NmdBottomNav.navHeight +
        NmdSpacing.sm;
    final position = config.floatingSupportPosition;

    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (decision.visible)
          Directionality(
            textDirection: TextDirection.rtl,
            child: Align(
              alignment: capsuleAlignment(position),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: EdgeInsetsDirectional.only(
                    start: NmdSpacing.screenHorizontal,
                    end: NmdSpacing.screenHorizontal,
                    bottom: bottomPad,
                  ),
                  child: SupportFloatingCapsule(
                    key: const ValueKey('nmd-support-capsule'),
                    label: SupportRoutePolicy.capsuleLabel(
                      hasOrderContext: false,
                    ),
                    animationEnabled: config.floatingSupportAnimationEnabled,
                    onTap: () => _openHub(config, path),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
