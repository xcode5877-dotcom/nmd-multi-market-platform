import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

final class CoinsBalanceState extends Equatable {
  const CoinsBalanceState({
    this.balance,
    this.loading = false,
    this.isAuthenticated = false,
  });

  final int? balance;
  final bool loading;
  final bool isAuthenticated;

  CoinsBalanceState copyWith({
    int? balance,
    bool? clearBalance,
    bool? loading,
    bool? isAuthenticated,
  }) {
    return CoinsBalanceState(
      balance: clearBalance == true ? null : (balance ?? this.balance),
      loading: loading ?? this.loading,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }

  @override
  List<Object?> get props => [balance, loading, isAuthenticated];
}

class CoinsBalanceCubit extends Cubit<CoinsBalanceState> {
  CoinsBalanceCubit(this._dio) : super(const CoinsBalanceState());

  final Dio _dio;

  Future<void> refresh() => loadForReason('startup');

  /// Same balance fetch as [refresh], but adds cache-busting query params and
  /// no-cache headers so the client does not reuse a stale GET /customer/coins.
  Future<void> load() => loadForReason('manual');

  /// Server-backed refresh with structured logs (`reason`: push, resume, redeem, startup, …).
  Future<void> loadForReason(String reason) async {
    final before = state.balance;
    debugPrint(
      '[COINS_REFRESH] reason=$reason before=$before success=pending',
    );
    await _fetch(bustCache: true);
    final after = state.balance;
    final success = !state.loading && (state.isAuthenticated || after != null);
    debugPrint(
      '[COINS_REFRESH] reason=$reason before=$before after=$after success=$success',
    );
  }

  void applyBalance(int balance) {
    emit(
      CoinsBalanceState(
        balance: balance,
        loading: false,
        isAuthenticated: true,
      ),
    );
  }

  Future<void> _fetch({required bool bustCache}) async {
    emit(state.copyWith(loading: true));
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/customer/coins',
        queryParameters: bustCache
            ? <String, dynamic>{'t': DateTime.now().millisecondsSinceEpoch}
            : null,
        options: bustCache
            ? Options(
                headers: <String, String>{
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache',
                },
              )
            : Options(),
      );
      final b = (res.data?['balance'] as num?)?.toInt();
      emit(
          CoinsBalanceState(balance: b, loading: false, isAuthenticated: true));
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        emit(const CoinsBalanceState(
          balance: null,
          loading: false,
          isAuthenticated: false,
        ));
        return;
      }
      emit(state.copyWith(loading: false));
    } catch (_) {
      emit(state.copyWith(loading: false));
    }
  }
}
