import 'package:flutter/foundation.dart';

import 'coins_balance_cubit.dart';

/// App-wide access to [CoinsBalanceCubit] for FCM handlers (no [BuildContext]).
final class CoinsBalanceRegistry {
  CoinsBalanceRegistry._();

  static CoinsBalanceCubit? _cubit;

  static void register(CoinsBalanceCubit? cubit) {
    _cubit = cubit;
    debugPrint('[COINS_REFRESH] cubit_available=${cubit != null}');
  }

  static Future<void> refresh(String reason) async {
    final cubit = _cubit;
    debugPrint(
      '[COINS_REFRESH] cubit_available=${cubit != null} reason=$reason',
    );
    if (cubit == null) {
      debugPrint('[COINS_REFRESH] skipped_no_cubit reason=$reason');
      return;
    }
    try {
      await cubit.loadForReason(reason);
    } catch (e, st) {
      debugPrint('[COINS_REFRESH] failed reason=$reason $e\n$st');
    }
  }
}
