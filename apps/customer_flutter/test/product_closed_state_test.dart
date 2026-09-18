import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/catalog/domain/store_availability.dart';
import 'package:customer_flutter/features/catalog/presentation/widgets/product_details/product_availability_banner.dart';
import 'package:customer_flutter/features/catalog/presentation/widgets/product_details/product_details_bottom_bar.dart';
import 'package:customer_flutter/api/models/product_measurement.dart';

void main() {
  group('StoreAvailability', () {
    test('FORCE_CLOSED wins over open operationalStatus', () {
      final a = StoreAvailability.fromTenantMap({
        'operationalStatus': 'open',
        'overrideStatus': 'FORCE_CLOSED',
      });
      expect(a.isClosed, isTrue);
      expect(a.reason, StoreClosedReason.forceClosed);
      expect(a.bannerTitleAr, contains('مغلق'));
    });

    test('schedule closed', () {
      final a = StoreAvailability.fromTenantMap({
        'operationalStatus': 'closed',
      });
      expect(a.isClosed, isTrue);
      expect(a.reason, StoreClosedReason.closedBySchedule);
    });

    test('open', () {
      final a = StoreAvailability.fromTenantMap({
        'operationalStatus': 'open',
      });
      expect(a.isClosed, isFalse);
    });

    test('missing defaults closed', () {
      final a = StoreAvailability.fromTenantMap({});
      expect(a.isClosed, isTrue);
    });
  });

  group('ProductAvailabilityBanner', () {
    testWidgets('renders closed copy', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductAvailabilityBanner(
              storeAvailability: StoreAvailability.fromTenantMap({
                'operationalStatus': 'closed',
              }),
            ),
          ),
        ),
      );
      expect(find.textContaining('المحل مغلق'), findsOneWidget);
      expect(find.textContaining('الإضافة إلى السلة'), findsOneWidget);
    });
  });

  group('weight null max vs configured', () {
    test('null max → single option → +/- both false', () {
      const m = ProductMeasurement(
        measurementType: 'WEIGHT',
        baseUnitCode: 'kg',
        displayUnitCode: 'kg',
        quantityStep: 0.25,
        minimumQuantity: 0.25,
        maximumQuantity: null,
        priceBasis: 'PER_BASE_UNIT',
        measurementVersion: 1,
        isWeightBased: true,
        unitName: 'كغم',
      );
      expect(m.selectableQuantities(), [0.25]);
      expect(m.canDecrementFrom(0.25), isFalse);
      expect(m.canIncrementFrom(0.25), isFalse);
    });

    test('configured max steps 0.25→2', () {
      const m = ProductMeasurement(
        measurementType: 'WEIGHT',
        baseUnitCode: 'kg',
        displayUnitCode: 'kg',
        quantityStep: 0.25,
        minimumQuantity: 0.25,
        maximumQuantity: 2,
        priceBasis: 'PER_BASE_UNIT',
        measurementVersion: 1,
        isWeightBased: true,
        unitName: 'كغم',
      );
      expect(
        m.selectableQuantities(),
        [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
      );
      expect(m.canDecrementFrom(0.25), isFalse);
      expect(m.canIncrementFrom(0.25), isTrue);
      expect(m.canIncrementFrom(2.0), isFalse);
      expect(m.canDecrementFrom(2.0), isTrue);
    });
  });

  group('ProductDetailsBottomBar quantity vs cart disable', () {
    testWidgets('closed cart still allows weight step taps when interaction on',
        (tester) async {
      var steps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Stack(
              children: [
                ProductDetailsBottomBar(
                  unitPrice: 85,
                  quantity: 1,
                  onQuantityChanged: (_) {},
                  onPressed: () {},
                  disabled: true,
                  disabledCtaLabel: 'المحل مغلق',
                  quantityInteractionEnabled: true,
                  isWeightProduct: true,
                  weightQuantityLabel: '0.25kg',
                  lineTotal: 21.25,
                  canWeightDecrement: false,
                  canWeightIncrement: true,
                  onWeightStep: (_) => steps++,
                ),
              ],
            ),
          ),
        ),
      );
      expect(find.text('المحل مغلق'), findsOneWidget);
      await tester.tap(find.byIcon(Icons.add_rounded));
      await tester.pump();
      expect(steps, 1);
    });
  });
}
