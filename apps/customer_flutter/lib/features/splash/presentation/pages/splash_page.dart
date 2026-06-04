import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../api/storefront_api.dart';
import '../../../../core/app_update/app_update_gate.dart';
import '../../../app_update/presentation/pages/force_update_page.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';

void _logSplash(Object message) {
  if (kDebugMode) debugPrint(message.toString());
}

/// Premium brand splash: warm-up identity/session and fetch coins, then transition.
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  bool _forceUpdate = false;
  String _forceUpdateMessage = kDefaultForceUpdateMessageAr;
  String? _forceUpdateAppStoreId;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    if (!mounted) return;
    final authBloc = context.read<AuthBloc>();
    final dio = context.read<Dio>();

    final updateGate = await AppUpdateGate.check(dio);
    if (!mounted) return;
    if (updateGate.mustForceUpdate) {
      setState(() {
        _forceUpdate = true;
        _forceUpdateMessage = updateGate.messageAr;
        _forceUpdateAppStoreId = updateGate.iosAppStoreId;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        WidgetsBinding.instance.allowFirstFrame();
      });
      return;
    }
    if (authBloc.state.step != AuthStep.done) {
      try {
        await authBloc
            .restoreSession()
            .timeout(const Duration(seconds: 5), onTimeout: () => false);
      } catch (_) {
        // Best effort: proceed even if no session (guest).
      }
    }

    try {
      final api = StorefrontApi(dio);
      final marketsFuture = api.fetchMarketsForPicker();
      final warmupTasks = <Future<void>>[
        marketsFuture.then((_) {}).catchError((Object e, StackTrace st) {
          _logSplash('WARN splash warm-up getMarkets: $e');
          _logSplash(st);
        }),
      ];
      if (authBloc.state.step == AuthStep.done) {
        warmupTasks.add(
          dio.get<Map<String, dynamic>>(
            '/customer/coins',
            queryParameters: <String, dynamic>{
              't': DateTime.now().millisecondsSinceEpoch
            },
          ).then((res) {
            _logSplash(
                '[Splash] coins prefetch balance=${res.data?['balance']}');
          }).catchError((Object e, StackTrace st) {
            _logSplash('WARN splash warm-up customer coins: $e');
            _logSplash(st);
          }),
        );
      }
      await Future.wait(warmupTasks, eagerError: false);
      if (!mounted) return;
      final markets = await marketsFuture;
      if (!mounted) return;
      if (markets.length == 1) {
        context.go('/market/${markets.first.slug}');
      } else {
        context.go('/main');
      }
    } catch (e, st) {
      _logSplash('WARN splash warm-up: $e');
      _logSplash(st);
      if (!mounted) return;
      context.go('/main');
    }

    // Remove native splash only after the first frame of the next route is rendered.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      WidgetsBinding.instance.allowFirstFrame();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_forceUpdate) {
      return ForceUpdatePage(
        messageAr: _forceUpdateMessage,
        iosAppStoreId: _forceUpdateAppStoreId,
      );
    }
    return Scaffold(
      backgroundColor: const Color(0xFF0F6F6B),
      body: const SizedBox.expand(),
    );
  }
}
