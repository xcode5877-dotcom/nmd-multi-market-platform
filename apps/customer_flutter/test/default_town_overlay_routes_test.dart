import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/account/presentation/widgets/default_delivery_town_setup_gate.dart';

void main() {
  group('defaultTownOverlayAllowedForRoute', () {
    test('allows overlay on home and store browse', () {
      expect(defaultTownOverlayAllowedForRoute('/market/dabburiyya'), isTrue);
      expect(
        defaultTownOverlayAllowedForRoute('/market/dabburiyya/store/s1'),
        isTrue,
      );
      expect(
        defaultTownOverlayAllowedForRoute('/market/dabburiyya/rewards'),
        isTrue,
      );
    });

    test('blocks overlay on account orders cart checkout', () {
      expect(
        defaultTownOverlayAllowedForRoute('/market/dabburiyya/account'),
        isFalse,
      );
      expect(
        defaultTownOverlayAllowedForRoute(
            '/market/dabburiyya/account/edit-profile'),
        isFalse,
      );
      expect(
        defaultTownOverlayAllowedForRoute('/market/dabburiyya/orders'),
        isFalse,
      );
      expect(
        defaultTownOverlayAllowedForRoute('/market/dabburiyya/cart'),
        isFalse,
      );
      expect(
        defaultTownOverlayAllowedForRoute('/market/dabburiyya/checkout'),
        isFalse,
      );
    });

    test('blocks overlay with trailing slash and query params', () {
      expect(
        defaultTownOverlayAllowedForRoute('/market/dabburiyya/account/'),
        isFalse,
      );
      expect(
        defaultTownOverlayAllowedForRoute(
            '/market/dabburiyya/orders/?tab=active'),
        isFalse,
      );
      expect(
        defaultTownOverlayAllowedForRoute('/market/dabburiyya/cart?x=1'),
        isFalse,
      );
      expect(
        defaultTownOverlayAllowedForRoute('/market/dabburiyya/checkout/'),
        isFalse,
      );
    });
  });
}
