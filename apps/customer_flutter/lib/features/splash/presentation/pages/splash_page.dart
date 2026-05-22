import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../api/storefront_api.dart';
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
  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    if (!mounted) return;
    final authBloc = context.read<AuthBloc>();
    final dio = context.read<Dio>();
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
      final warmupTasks = <Future<void>>[
        api.getMarkets().then((_) {}).catchError((Object e, StackTrace st) {
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
    } catch (e, st) {
      _logSplash('WARN splash warm-up: $e');
      _logSplash(st);
    }

    if (!mounted) return;
    context.go('/main');
    // Remove native splash only after the first frame of the next route is rendered.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      WidgetsBinding.instance.allowFirstFrame();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F6F6B),
      body: const SizedBox.expand(),
    );
  }
}
