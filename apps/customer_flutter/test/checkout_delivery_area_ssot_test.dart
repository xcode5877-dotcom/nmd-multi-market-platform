import 'package:flutter_test/flutter_test.dart';
import 'package:customer_flutter/features/account/application/customer_profile_cubit.dart';
import 'package:customer_flutter/features/account/domain/checkout_delivery_area.dart';

void main() {
  final zones = <Map<String, dynamic>>[
    {'id': 'z-dab', 'name': 'دبورية', 'fee': 10},
    {'id': 'z-iks', 'name': 'إكسال', 'fee': 15},
  ];

  group('CustomerProfileState default town', () {
    test('1. registration canonical field stores دبورية', () {
      const state = CustomerProfileState(defaultDeliveryTown: 'دبورية');
      expect(state.primaryDeliveryArea, 'دبورية');
      expect(state.hasPrimaryDeliveryArea, isTrue);
    });
  });

  group('CheckoutDeliveryAreaController', () {
    test('2. checkout initializes from profile دبورية', () {
      final c = CheckoutDeliveryAreaController();
      final s = c.initializeFromProfile(
        defaultTown: 'دبورية',
        activeZones: zones,
      );
      expect(s.selectedAreaName, 'دبورية');
      expect(s.selectedAreaId, 'z-dab');
      expect(s.deliveryFeeAgora, 1000);
      expect(s.hasUserOverridden, isFalse);
      expect(c.createOrderDeliveryAreaId, 'دبورية');
      final payload = c.buildCreateOrderDelivery(
        method: 'DELIVERY',
        feeAgoraForOrder: s.deliveryFeeAgora,
        addressText: defaultAddressForTown('دبورية'),
      );
      expect(payload['deliveryAreaId'], 'دبورية');
      expect(payload['zoneId'], 'z-dab');
    });

    test('3. checkout override to إكسال does not change profile default', () {
      final profile = const CustomerProfileState(defaultDeliveryTown: 'دبورية');
      final c = CheckoutDeliveryAreaController();
      c.initializeFromProfile(
        defaultTown: profile.primaryDeliveryArea,
        activeZones: zones,
      );
      c.selectArea(areaId: 'z-iks', activeZones: zones);
      expect(c.state.selectedAreaName, 'إكسال');
      expect(c.state.selectedAreaId, 'z-iks');
      expect(c.state.deliveryFeeAgora, 1500);
      expect(c.state.hasUserOverridden, isTrue);
      expect(c.createOrderDeliveryAreaId, 'إكسال');
      // Profile remains دبورية
      expect(profile.primaryDeliveryArea, 'دبورية');
      expect(c.state.defaultTown, 'دبورية');
    });

    test('4. new checkout session re-initializes from profile default', () {
      final c = CheckoutDeliveryAreaController();
      c.initializeFromProfile(defaultTown: 'دبورية', activeZones: zones);
      c.selectArea(areaId: 'z-iks', activeZones: zones);
      expect(c.state.selectedAreaName, 'إكسال');
      c.resetForNewCheckout();
      c.initializeFromProfile(defaultTown: 'دبورية', activeZones: zones);
      expect(c.state.selectedAreaName, 'دبورية');
      expect(c.state.hasUserOverridden, isFalse);
    });

    test('5. rebuild/reprice keeps explicit override', () {
      final c = CheckoutDeliveryAreaController();
      c.initializeFromProfile(defaultTown: 'دبورية', activeZones: zones);
      c.selectArea(areaId: 'z-iks', activeZones: zones);
      final afterReprice = c.revalidateSelection(activeZones: zones);
      expect(afterReprice.selectedAreaId, 'z-iks');
      expect(afterReprice.selectedAreaName, 'إكسال');
      expect(afterReprice.deliveryFeeAgora, 1500);
      expect(afterReprice.hasUserOverridden, isTrue);
    });

    test('6. profile refresh does not overwrite explicit override', () {
      final c = CheckoutDeliveryAreaController();
      c.initializeFromProfile(defaultTown: 'دبورية', activeZones: zones);
      c.selectArea(areaId: 'z-iks', activeZones: zones);
      c.syncProfileDefaultIfNotOverridden(
        defaultTown: 'طمرة',
        activeZones: zones,
      );
      expect(c.state.selectedAreaName, 'إكسال');
      expect(c.state.hasUserOverridden, isTrue);
      expect(c.state.defaultTown, 'طمرة');
    });

    test('7. without override, profile change updates checkout selection', () {
      final c = CheckoutDeliveryAreaController();
      c.initializeFromProfile(defaultTown: 'دبورية', activeZones: zones);
      expect(c.state.hasUserOverridden, isFalse);
      c.syncProfileDefaultIfNotOverridden(
        defaultTown: 'إكسال',
        activeZones: zones,
      );
      expect(c.state.selectedAreaName, 'إكسال');
      expect(c.state.selectedAreaId, 'z-iks');
      expect(c.state.hasUserOverridden, isFalse);
    });

    test('8. unsupported default has no first-zone fallback', () {
      final c = CheckoutDeliveryAreaController();
      final s = c.initializeFromProfile(
        defaultTown: 'طمرة',
        activeZones: zones,
      );
      expect(s.hasSelection, isFalse);
      expect(s.selectedAreaId, isNull);
      expect(s.error, 'يرجى اختيار منطقة التوصيل');
      expect(c.createOrderDeliveryAreaId, isNull);
    });

    test('9. deactivated area after selection blocks confirmation', () {
      final c = CheckoutDeliveryAreaController();
      c.initializeFromProfile(defaultTown: 'دبورية', activeZones: zones);
      c.selectArea(areaId: 'z-iks', activeZones: zones);
      final onlyDab = [zones.first];
      final s = c.revalidateSelection(activeZones: onlyDab);
      expect(s.hasSelection, isFalse);
      expect(s.canConfirmDelivery, isFalse);
      expect(s.error, contains('لم تعد متاحة'));
    });

    test('10. address compatibility adapts or invalidates cleanly', () {
      final adapted = adaptAddressForAreaChange(
        currentAddress: defaultAddressForTown('دبورية'),
        previousAreaName: 'دبورية',
        newAreaName: 'إكسال',
      );
      expect(adapted, defaultAddressForTown('إكسال'));

      final incompatible = adaptAddressForAreaChange(
        currentAddress: 'دبورية - شارع 1',
        previousAreaName: 'إكسال',
        newAreaName: 'إكسال',
      );
      expect(incompatible, isNull);

      expect(
        isAddressCompatibleWithArea(
          address: 'إكسال - شارع 5',
          areaName: 'إكسال',
        ),
        isTrue,
      );
      expect(
        isAddressCompatibleWithArea(
          address: 'دبورية - شارع 5',
          areaName: 'إكسال',
        ),
        isFalse,
      );
    });

    test('11. payload uses checkout selected areaId not profile', () {
      final c = CheckoutDeliveryAreaController();
      c.initializeFromProfile(defaultTown: 'دبورية', activeZones: zones);
      c.selectArea(areaId: 'z-iks', activeZones: zones);
      final payload = c.buildCreateOrderDelivery(
        method: 'DELIVERY',
        feeAgoraForOrder: c.state.deliveryFeeAgora,
        addressText: defaultAddressForTown('إكسال'),
      );
      expect(payload['deliveryAreaId'], 'إكسال');
      expect(payload['zoneId'], 'z-iks');
      expect(payload['zoneName'], 'إكسال');
      expect(payload['fee'], 15);
    });

    test('12. save-as-default omitted — selectArea never mutates profile', () {
      var profileTown = 'دبورية';
      final c = CheckoutDeliveryAreaController();
      c.initializeFromProfile(defaultTown: profileTown, activeZones: zones);
      c.selectArea(areaId: 'z-iks', activeZones: zones);
      // No API / cubit write path in selectArea.
      expect(profileTown, 'دبورية');
      expect(c.state.defaultTown, 'دبورية');
    });

    test('empty profile requires manual selection — no first zone', () {
      final c = CheckoutDeliveryAreaController();
      final s = c.initializeFromProfile(defaultTown: null, activeZones: zones);
      expect(s.hasSelection, isFalse);
      expect(s.selectedAreaId, isNull);
      expect(s.error, 'يرجى اختيار منطقة التوصيل');
    });

    test('delivery fee stored as agora integers', () {
      expect(deliveryFeeNisToAgora(10), 1000);
      expect(deliveryFeeNisToAgora(15.5), 1550);
      expect(deliveryFeeAgoraToNis(1500), 15);
    });
  });
}
