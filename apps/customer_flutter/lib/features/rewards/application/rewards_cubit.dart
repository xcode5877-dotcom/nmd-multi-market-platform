import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../data/reward_item.dart';
import '../../../core/errors/app_error_mapper.dart';

enum RewardsStatus { initial, loading, loaded, failure }

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

  void setFilter(RewardFilter filter) {
    if (state.status != RewardsStatus.loaded) return;
    emit(state.copyWith(filter: filter));
  }

  Future<void> load() async {
    emit(
      state.copyWith(
        status: RewardsStatus.loading,
        clearErrorMessage: true,
      ),
    );
    try {
      final rewardsRes = await _dio.get('/rewards');
      final raw = rewardsRes.data as List<dynamic>? ?? [];
      final rewards = raw
          .map((e) => RewardItem.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();

      emit(
        RewardsState(
          status: RewardsStatus.loaded,
          rewards: rewards,
          filter: state.filter,
        ),
      );
    } catch (e) {
      AppErrorMapper.log(e, context: 'rewards');
      emit(
        state.copyWith(
          status: RewardsStatus.failure,
          errorMessage: AppErrorMapper.friendlyMessage(e),
        ),
      );
    }
  }

  Future<String?> redeem(String rewardId) async {
    emit(state.copyWith(redeemingId: rewardId));
    try {
      await _dio.post('/customer/rewards/$rewardId/redeem');
      await load();
      return null;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return 'login';
      final msg = e.response?.data;
      if (msg is Map && msg['error'] is String) {
        return msg['error'] as String;
      }
      return e.message ?? 'فشل الاستبدال';
    } catch (e) {
      return e.toString();
    } finally {
      emit(state.copyWith(clearRedeeming: true));
    }
  }
}
