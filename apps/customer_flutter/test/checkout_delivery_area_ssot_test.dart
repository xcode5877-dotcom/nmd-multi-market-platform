import 'package:flutter_test/flutter_test.dart';
import 'package:customer_flutter/features/account/application/customer_profile_cubit.dart';
import 'package:customer_flutter/features/account/domain/checkout_delivery_area.dart';

void main() {
  group('resolveCheckoutDeliveryArea (profile SSOT)', () {
    final zones = <Map<String, dynamic>>[
      {'id': 'z-dab', 'name': 'دبورية', 'fee': 10},
      {'id': 'z-iks', 'name': 'إكسال', 'fee': 15},
    ];

    test('uses profile town only — no implicit first-zone default', () {
      final empty = resolveCheckoutDeliveryArea(
        profileTown: null,
        zones: zones,
      );
      expect(empty.hasProfileTown, isFalse);
      expect(empty.zoneId, isNull);
      expect(empty.canDeliver, isFalse);

      final blank = resolveCheckoutDeliveryArea(
        profileTown: '   ',
        zones: zones,
      );
      expect(blank.hasProfileTown, isFalse);
      expect(blank.canDeliver, isFalse);
    });

    test('دابورية from profile resolves matching zone', () {
      final area = resolveCheckoutDeliveryArea(
        profileTown: 'دبورية',
        zones: zones,
      );
      expect(area.profileTown, 'دبورية');
      expect(area.zoneId, 'z-dab');
      expect(area.zoneName, 'دبورية');
      expect(area.canDeliver, isTrue);
    });

    test('إكسال from profile resolves matching zone', () {
      final area = resolveCheckoutDeliveryArea(
        profileTown: 'إكسال',
        zones: zones,
      );
      expect(area.profileTown, 'إكسال');
      expect(area.zoneId, 'z-iks');
      expect(area.canDeliver, isTrue);
    });

    test('unsupported profile town does not invent another area', () {
      final area = resolveCheckoutDeliveryArea(
        profileTown: 'طمرة',
        zones: zones,
      );
      expect(area.hasProfileTown, isTrue);
      expect(area.profileTown, 'طمرة');
      expect(area.zoneMatched, isFalse);
      expect(area.canDeliver, isFalse);
    });

    test('create-order deliveryAreaId equals profile town', () {
      final area = resolveCheckoutDeliveryArea(
        profileTown: 'دبورية',
        zones: zones,
      );
      final delivery = <String, dynamic>{
        'deliveryAreaId': area.profileTown,
        if (area.zoneId != null) 'zoneId': area.zoneId,
        if (area.zoneName != null) 'zoneName': area.zoneName,
      };
      expect(delivery['deliveryAreaId'], 'دبورية');
      expect(delivery['zoneId'], 'z-dab');
    });
  });

  group('CustomerProfileState primaryDeliveryArea', () {
    test('canonical getter trims town', () {
      const state = CustomerProfileState(defaultDeliveryTown: '  دبورية  ');
      expect(state.primaryDeliveryArea, 'دبورية');
      expect(state.hasPrimaryDeliveryArea, isTrue);
    });

    test('clearTown removes area', () {
      const state = CustomerProfileState(defaultDeliveryTown: 'إكسال');
      final cleared = state.copyWith(clearTown: true);
      expect(cleared.hasPrimaryDeliveryArea, isFalse);
      expect(cleared.primaryDeliveryArea, '');
    });
  });
}
