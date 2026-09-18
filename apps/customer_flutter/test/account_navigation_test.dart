import 'package:flutter_test/flutter_test.dart';
import 'package:customer_flutter/core/auth/protected_customer_navigation.dart';

void main() {
  test('protected account route exists', () {
    expect(
      protectedCustomerRoute('dabburiyya', ProtectedCustomerDestination.account),
      '/market/dabburiyya/account',
    );
    expect(
      protectedCustomerRoute('dabburiyya', ProtectedCustomerDestination.orders),
      '/market/dabburiyya/orders',
    );
  });
}
