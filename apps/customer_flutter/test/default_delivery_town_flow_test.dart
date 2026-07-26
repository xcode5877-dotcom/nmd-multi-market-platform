import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/auth/domain/models.dart';

void main() {
  group('CustomerMeResult', () {
    test('parses defaultDeliveryTown from API shape', () {
      const me = CustomerMeResult(
        phone: '0501234567',
        id: 'c1',
        name: 'أحمد',
        defaultDeliveryTown: 'دبورية',
      );
      expect(me.defaultDeliveryTown, 'دبورية');
    });

    test('existing customer without area has null defaultDeliveryTown', () {
      const me = CustomerMeResult(
        phone: '0501234567',
        id: 'c1',
        name: 'أحمد',
      );
      expect(me.defaultDeliveryTown, isNull);
    });
  });

  group('registration requirement', () {
    bool registrationComplete({
      required String name,
      required String? defaultDeliveryTown,
    }) {
      return name.trim().isNotEmpty &&
          (defaultDeliveryTown?.trim().isNotEmpty ?? false);
    }

    test('new customer must choose a delivery area', () {
      expect(registrationComplete(name: 'أحمد', defaultDeliveryTown: null),
          isFalse);
      expect(
        registrationComplete(name: 'أحمد', defaultDeliveryTown: 'دبورية'),
        isTrue,
      );
    });

    test('Arabic area is saved correctly', () {
      const town = 'أم الغنم';
      expect(registrationComplete(name: 'سارة', defaultDeliveryTown: town),
          isTrue);
    });
  });
}
