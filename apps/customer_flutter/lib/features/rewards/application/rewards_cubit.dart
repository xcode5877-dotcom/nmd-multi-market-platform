import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../data/reward_item.dart';
import '../../../core/auth/auth_failure.dart';
import '../../../core/errors/app_error_mapper.dart';
import '../../../core/network/token_storage.dart';

enum RewardsStatus { initial, loading, loaded, failure }

final class RedeemOutcome extends Equatable {
  const RedeemOutcome.success({
    required this.newBalance,
    required this.successMessage,
    this.couponCode,
  })  : ok = true,
        errorMessage = null,
        loginRequired = false,
        sessionExpired = false;

  const RedeemOutcome.failure(this.errorMessage)
      : ok = false,
        newBalance = null,
        successMessage = null,
        couponCode = null,
        loginRequired = false,
        sessionExpired = false;

  const RedeemOutcome.needsLogin()
      : ok = false,
        errorMessage = null,
        newBalance = null,
        successMessage = null,
        couponCode = null,
        loginRequired = true,
        sessionExpired = false;

  const RedeemOutcome.sessionExpired()
      : ok = false,
        errorMessage = kSessionExpiredMessage,
        newBalance = null,
        successMessage = null,
        couponCode = null,
        loginRequired = false,
        sessionExpired = true;

  final bool ok;
  final String? errorMessage;
  final bool loginRequired;
  final bool sessionExpired;
  final int? newBalance;
  final String? successMessage;
  final String? couponCode;

  @override
  List<Object?> get props => [
        ok,
        errorMessage,
        loginRequired,
        sessionExpired,
        newBalance,
        successMessage,
        couponCode,
      ];
}

final class RewardsState extends Equatable {
  const RewardsState({
    this.status = RewardsStatus.initial,
    this.rewards = const [],
    this.errorMessage,
    this.filter = RewardFilter.all,
    this.redeemingId,
  });

  final RewardsStatus status;
  final List<RewardItem> rewards;
  final String? errorMessage;
  final RewardFilter filter;
  final String? redeemingId;

  List<RewardItem> get filteredRewards =>
      rewards.where((r) => r.matchesFilter(filter)).toList();

  RewardsState copyWith({
    RewardsStatus? status,
    List<RewardItem>? rewards,
    String? errorMessage,
    bool clearErrorMessage = false,
    RewardFilter? filter,
    String? redeemingId,
    bool clearRedeeming = false,
  }) {
    return RewardsState(
      status: status ?? this.status,
      rewards: rewards ?? this.rewards,
      errorMessage:
          clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
      filter: filter ?? this.filter,
      redeemingId: clearRedeeming ? null : (redeemingId ?? this.redeemingId),
    );
  }

  @override
  List<Object?> get props =>
      [status, rewards, errorMessage, filter, redeemingId];
}

class RewardsCubit extends Cubit<RewardsState> {
  RewardsCubit(this._dio, this._tokenStorage) : super(const RewardsState());

  final Dio _dio;
  final TokenStorage _tokenStorage;

  void _trace(String message, [Map<String, Object?>? data]) {
    if (!kDebugMode) return;
    developer.log(message, name: 'RewardsCubit', error: data);
    debugPrint('[RewardsCubit] $message${data == null ? '' : ' $data'}');
  }

  void setFilter(RewardFilter filter) {
    if (state.status != RewardsStatus.loaded) return;
    emit(state.copyWith(filter: filter));
  }

  Future<void> load({bool silent = false}) async {
    if (!silent) {
      emit(
        state.copyWith(
          status: RewardsStatus.loading,
          clearErrorMessage: true,
        ),
      );
    }
    try {
      _trace('load start', {'silent': silent});
      final rewards = await _fetchRewardsList();
      final redeemedCount = rewards.where((r) => r.redeemed).length;
      _trace('load ok', {
        'count': rewards.length,
        'redeemedCount': redeemedCount,
      });

      emit(
        RewardsState(
          status: RewardsStatus.loaded,
          rewards: rewards,
          filter: state.filter,
        ),
      );
    } catch (e) {
      _trace('load failed', {'error': e.toString(), 'silent': silent});
      if (silent && state.status == RewardsStatus.loaded) {
        return;
      }
      Object failure = e;
      if (e is DioException && e.response?.statusCode == 401) {
        final mode = classifyEndpointAuth(
          e.requestOptions.uri.path.isNotEmpty
              ? e.requestOptions.uri.path
              : e.requestOptions.path,
          method: e.requestOptions.method,
        );
        if (mode == EndpointAuthMode.optionalAuth) {
          await _tokenStorage.clear();
          try {
            final rewards = await _fetchRewardsList();
            emit(
              RewardsState(
                status: RewardsStatus.loaded,
                rewards: rewards,
                filter: state.filter,
              ),
            );
            return;
          } catch (retryError, retrySt) {
            failure = retryError;
            _trace('load retry failed', {'error': retryError.toString()});
            if (kDebugMode) {
              debugPrint('[RewardsCubit] retry stack: $retrySt');
            }
          }
        }
      }
      AppErrorMapper.log(failure, context: 'rewards');
      emit(
        state.copyWith(
          status: RewardsStatus.failure,
          errorMessage: AppErrorMapper.friendlyMessage(failure),
        ),
      );
    }
  }

  Future<List<RewardItem>> _fetchRewardsList() async {
    final rewardsRes = await _dio.get('/rewards');
    final raw = rewardsRes.data as List<dynamic>? ?? [];
    return raw
        .map((e) => RewardItem.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<RedeemOutcome> redeem(String rewardId) async {
    final token = await _tokenStorage.getCustomerToken();
    if (token == null || token.trim().isEmpty) {
      return const RedeemOutcome.needsLogin();
    }

    emit(state.copyWith(redeemingId: rewardId));
    _trace('redeem start', {'rewardId': rewardId});
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/customer/rewards/$rewardId/redeem',
      );
      final data = res.data ?? const <String, dynamic>{};
      final success = data['success'] != false;
      if (!success) {
        final msg = data['error']?.toString() ?? 'تعذّر إتمام العملية';
        return RedeemOutcome.failure(msg);
      }
      final newBalance = (data['remainingCoins'] as num?)?.toInt() ??
          (data['balance'] as num?)?.toInt();
      final redemptionStatus =
          (data['redemption_status'] as String?) ?? 'PENDING';
      final redemptionId =
          (data['rewardRedemptionId'] as String?) ?? (data['id'] as String?);
      final couponCode = data['couponCode']?.toString();

      _trace('redeem ok', {
        'rewardId': rewardId,
        'balance': newBalance,
        'status': redemptionStatus,
        'redemptionId': redemptionId,
        'couponCode': couponCode,
      });

      final updatedRewards = state.rewards
          .map(
            (r) => r.id == rewardId
                ? r.copyWith(
                    redeemed: true,
                    redemptionStatus: redemptionStatus,
                    redemptionId: redemptionId,
                  )
                : r,
          )
          .toList();

      emit(
        state.copyWith(
          rewards: updatedRewards,
          clearRedeeming: true,
        ),
      );

      // Best-effort refresh; do not fail a successful redeem if reload fails.
      try {
        await load(silent: true);
      } catch (e, st) {
        _trace('redeem reload failed (ignored)', {'error': e.toString()});
        if (kDebugMode) debugPrint('[RewardsCubit] post-redeem reload: $st');
      }

      RewardItem? reward;
      for (final r in state.rewards) {
        if (r.id == rewardId) {
          reward = r;
          break;
        }
      }
      final successMessage = couponCode != null && couponCode.isNotEmpty
          ? 'تم الاستبدال! كود القسيمة: $couponCode'
          : (reward?.type.toUpperCase() == 'TOURNAMENT' ||
                  reward?.type.toUpperCase() == 'EVENT')
              ? 'تمت المشاركة بنجاح'
              : rewardRedeemSuccessMessageAr;

      return RedeemOutcome.success(
        newBalance: newBalance,
        successMessage: successMessage,
        couponCode: couponCode,
      );
    } on DioException catch (e) {
      emit(state.copyWith(clearRedeeming: true));
      final status = e.response?.statusCode;
      final body = e.response?.data;
      _trace('redeem failed', {
        'rewardId': rewardId,
        'status': status,
        'body': body,
      });
      if (status == 401) {
        final kind = authFailureKindFromDio(e);
        if (kind == AuthFailureKind.sessionExpired) {
          await _tokenStorage.clear();
          return const RedeemOutcome.sessionExpired();
        }
        return const RedeemOutcome.needsLogin();
      }
      return RedeemOutcome.failure(_mapRedeemError(e));
    } catch (e) {
      emit(state.copyWith(clearRedeeming: true));
      _trace('redeem error', {'rewardId': rewardId, 'error': e.toString()});
      return RedeemOutcome.failure('تعذّر إتمام العملية، حاول مجدداً');
    }
  }

  String _mapRedeemError(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final code = data['code'] as String?;
      switch (code) {
        case 'INSUFFICIENT_COINS':
          return 'رصيدك غير كافٍ';
        case 'ALREADY_REDEEMED':
          return 'سبق أن شاركت في هذه المكافأة';
        case 'SOLD_OUT':
          return 'نفدت الكمية المتاحة';
        case 'EXPIRED':
          return 'انتهت صلاحية هذه المكافأة';
      }
      final msg = data['error'];
      if (msg is String && msg.isNotEmpty) {
        final lower = msg.toLowerCase();
        if (lower.contains('insufficient')) return 'رصيدك غير كافٍ';
        if (lower.contains('already redeemed')) {
          return 'سبق أن شاركت في هذه المكافأة';
        }
        if (lower.contains('out of stock')) return 'نفدت الكمية المتاحة';
        if (lower.contains('expired')) return 'انتهت صلاحية هذه المكافأة';
      }
    }
    return AppErrorMapper.friendlyMessage(e);
  }
}
