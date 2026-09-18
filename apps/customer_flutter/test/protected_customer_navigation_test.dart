import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/core/auth/protected_customer_navigation.dart';

void main() {
  setUp(() {
    resetProtectedCustomerNavBusyForTest();
  });

  test('orders and account share protected route builder', () {
    expect(
      protectedCustomerRoute('m1', ProtectedCustomerDestination.orders),
      '/market/m1/orders',
    );
    expect(
      protectedCustomerRoute('m1', ProtectedCustomerDestination.account),
      '/market/m1/account',
    );
  });

  test('nav busy flag resets', () {
    expect(protectedCustomerNavBusyForTest(), isFalse);
  });
}
