import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../data/reward_item.dart';
import '../../../core/errors/app_error_mapper.dart';

enum RewardsStatus { initial, loading, loaded, failure }

final class RedeemOutcome extends Equatable {
  const RedeemOutcome.success({
    required this.newBalance,
    required this.successMessage,
  })  : ok = true,
        errorMessage = null,
        loginRequired = false;

  const RedeemOutcome.failure(this.errorMessage)
      : ok = false,
        newBalance = null,
        successMessage = null,
        loginRequired = false;

  const RedeemOutcome.needsLogin()
      : ok = false,
        errorMessage = null,
        newBalance = null,
        successMessage = null,
        loginRequired = true;

  final bool ok;
  final String? errorMessage;
  final bool loginRequired;
  final int? newBalance;
  final String? successMessage;

  @override
  List<Object?> get props =>
      [ok, errorMessage, loginRequired, newBalance, successMessage];
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
  RewardsCubit(this._dio) : super(const RewardsState());

  final Dio _dio;

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
      final rewardsRes = await _dio.get('/rewards');
      final raw = rewardsRes.data as List<dynamic>? ?? [];
      final rewards = raw
          .map((e) => RewardItem.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();

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
      AppErrorMapper.log(e, context: 'rewards');
      emit(
        state.copyWith(
          status: RewardsStatus.failure,
          errorMessage: AppErrorMapper.friendlyMessage(e),
        ),
      );
    }
  }

  Future<RedeemOutcome> redeem(String rewardId) async {
    emit(state.copyWith(redeemingId: rewardId));
    _trace('redeem start', {'rewardId': rewardId});
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/customer/rewards/$rewardId/redeem',
      );
      final data = res.data ?? const <String, dynamic>{};
      final newBalance = (data['balance'] as num?)?.toInt();
      final redemptionStatus =
          (data['redemption_status'] as String?) ?? 'PENDING';
      final redemptionId = data['id'] as String?;

      _trace('redeem ok', {
        'rewardId': rewardId,
        'balance': newBalance,
        'status': redemptionStatus,
        'redemptionId': redemptionId,
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

      // Sync redemption flags from server (requires auth on GET /rewards).
      await load(silent: true);

      return RedeemOutcome.success(
        newBalance: newBalance,
        successMessage: rewardRedeemSuccessMessageAr,
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
