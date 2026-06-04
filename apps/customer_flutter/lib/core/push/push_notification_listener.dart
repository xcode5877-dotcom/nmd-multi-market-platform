import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../network/token_storage.dart';
import 'push_notification_service.dart';

/// Initializes FCM after login and on cold start when session exists.
class PushNotificationListener extends StatefulWidget {
  const PushNotificationListener({
    super.key,
    required this.router,
    required this.child,
  });

  final GoRouter router;
  final Widget child;

  @override
  State<PushNotificationListener> createState() => _PushNotificationListenerState();
}

class _PushNotificationListenerState extends State<PushNotificationListener> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bindPush());
  }

  Future<void> _bindPush() async {
    if (!mounted) return;
    final dio = context.read<Dio>();
    final tokenStorage = context.read<TokenStorage>();
    final authBloc = context.read<AuthBloc>();
    await PushNotificationService.instance.bind(
      router: widget.router,
      dio: dio,
      tokenStorage: tokenStorage,
    );
    if (!mounted) return;
    if (authBloc.state.step == AuthStep.done) {
      await PushNotificationService.instance.syncTokenAfterLogin();
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listenWhen: (prev, curr) => curr.step == AuthStep.done && prev.step != AuthStep.done,
      listener: (_, __) {
        unawaited(PushNotificationService.instance.syncTokenAfterLogin());
      },
      child: widget.child,
    );
  }
}
