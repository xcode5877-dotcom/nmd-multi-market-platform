import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/rewards/data/reward_item.dart';

void main() {
  group('RewardItem redemption fields', () {
    test('fromJson parses redeemed and redemption_status', () {
      final item = RewardItem.fromJson({
        'id': 'reward-1',
        'title_ar': 'بطولة',
        'title_en': 'Tournament',
        'type': 'TOURNAMENT',
        'coins_cost': 50,
        'locked': false,
        'redeemed': true,
        'redemption_status': 'PENDING',
        'redemption_id': 'rred-1',
      });

      expect(item.redeemed, isTrue);
      expect(item.redemptionStatus, 'PENDING');
      expect(item.redemptionId, 'rred-1');
      expect(item.isParticipated, isTrue);
    });

    test('redeemedLabelAr uses participation wording for tournaments/events', () {
      expect(rewardRedeemedLabelAr('TOURNAMENT'), 'تمت المشاركة');
      expect(rewardRedeemedLabelAr('EVENT'), 'تمت المشاركة');
      expect(rewardRedeemedLabelAr('PRIZE'), 'تم الاستبدال');
      expect(rewardRedeemedLabelAr('COUPON'), 'تم الاستبدال');
    });

    test('copyWith updates redemption state', () {
      const item = RewardItem(
        id: 'r1',
        titleAr: 'x',
        titleEn: 'y',
        type: 'PRIZE',
        coinsCost: 10,
        locked: false,
      );

      final updated = item.copyWith(
        redeemed: true,
        redemptionStatus: 'COMPLETED',
        redemptionId: 'rred-2',
      );

      expect(updated.redeemed, isTrue);
      expect(updated.redemptionStatus, 'COMPLETED');
    });
  });
}
