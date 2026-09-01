import 'dart:async';

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../debug/boot_trace.dart';

/// Owns the [WidgetsBinding.deferFirstFrame] / [allowFirstFrame] contract.
///
/// Guarantees [releaseOnce] invokes [allowFirstFrame] exactly one time after
/// [deferOnce], regardless of bootstrap success, failure, timeout, or dispose.
final class FirstFrameController {
  FirstFrameController._();

  static final FirstFrameController instance = FirstFrameController._();

  /// Visible for tests — do not use in production code.
  // ignore: visible_for_testing_member, library_private_types_in_public_api
  static FirstFrameController createForTest() => FirstFrameController._();

  bool _deferred = false;
  bool _released = false;
  Timer? _safetyTimer;
  final List<void Function(String reason)> _onReleased = [];

  /// Maximum time bootstrap may hold the native launch screen before the safety
  /// release fires. Does not skip [SplashPage] work — only prevents deadlock.
  static const Duration safetyTimeout = Duration(seconds: 20);

  /// Called once from [main] immediately after [WidgetsFlutterBinding.ensureInitialized].
  void deferOnce() {
    if (_deferred) {
      bootTrace('FirstFrameController.deferOnce SKIP already deferred');
      return;
    }
    _deferred = true;
    WidgetsBinding.instance.deferFirstFrame();
    bootTrace('FirstFrameController.deferOnce START');
    _safetyTimer?.cancel();
    _safetyTimer = Timer(safetyTimeout, () {
      bootTrace(
        'FirstFrameController SAFETY release — bootstrap exceeded '
        '${safetyTimeout.inSeconds}s',
      );
      releaseOnce('safety_timeout');
    });
  }

  /// Single shutdown path for splash (and safety timer). Idempotent.
  void releaseOnce(String reason) {
    if (_released) {
      bootTrace(
        'FirstFrameController.releaseOnce SKIP already released reason=$reason',
      );
      return;
    }
    _released = true;
    _safetyTimer?.cancel();
    _safetyTimer = null;
    bootTrace('FirstFrameController.releaseOnce SCHEDULE reason=$reason');
    SchedulerBinding.instance.addPostFrameCallback((_) {
      bootTrace('FirstFrameController.allowFirstFrame EXECUTE reason=$reason');
      WidgetsBinding.instance.allowFirstFrame();
      _notifyReleased(reason);
    });
  }

  void addOnReleasedListener(void Function(String reason) listener) {
    if (_released) {
      listener('already_released');
      return;
    }
    _onReleased.add(listener);
  }

  void _notifyReleased(String reason) {
    final copy = List<void Function(String reason)>.from(_onReleased);
    _onReleased.clear();
    for (final listener in copy) {
      listener(reason);
    }
  }

  // ignore: visible_for_testing_member
  bool get isDeferred => _deferred;

  // ignore: visible_for_testing_member
  bool get isReleased => _released;
}
