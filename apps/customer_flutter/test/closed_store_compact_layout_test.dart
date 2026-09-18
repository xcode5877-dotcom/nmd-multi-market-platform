import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/catalog/domain/store_availability.dart';
import 'package:customer_flutter/features/catalog/presentation/widgets/product_details/product_availability_banner.dart';

void main() {
  testWidgets('closed store card is compact (two text levels)', (tester) async {
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
    expect(find.byKey(const Key('product_availability_compact_card')), findsOneWidget);
    expect(find.text('المحل مغلق حاليا'), findsOneWidget);
    expect(find.textContaining('تصفح الخيارات'), findsOneWidget);
    // Must not dump the long operational paragraph on every product.
    expect(find.textContaining('ساعات العمل'), findsNothing);
  });
}
