import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/account/data/delivery_town_parser.dart';

void main() {
  group('parseDeliveryTownsResponse', () {
    test('parses { towns: [...] } with string items', () {
      final towns = parseDeliveryTownsResponse({
        'towns': ['دبورية', 'إكسال', 'شبلي'],
      });
      expect(towns, ['دبورية', 'إكسال', 'شبلي']);
    });

    test('parses raw array', () {
      final towns = parseDeliveryTownsResponse(['دبورية', 'إكسال']);
      expect(towns, ['دبورية', 'إكسال']);
    });

    test('parses { data: [...] } wrapped response', () {
      final towns = parseDeliveryTownsResponse({
        'data': [
          {'name': 'دبورية'},
          {'name': 'إكسال'},
        ],
      });
      expect(towns, ['دبورية', 'إكسال']);
    });

    test('parses object items with name field', () {
      final towns = parseDeliveryTownsResponse({
        'towns': [
          {'id': 't1', 'name': 'دبورية'},
          {'id': 't2', 'name': 'إكسال'},
        ],
      });
      expect(towns, ['دبورية', 'إكسال']);
    });

    test('throws on unrecognized shape', () {
      expect(
        () => parseDeliveryTownsResponse({'error': 'Unauthorized'}),
        throwsFormatException,
      );
    });

    test('returns empty list for recognized empty towns array', () {
      expect(parseDeliveryTownsResponse({'towns': []}), isEmpty);
    });
  });
}
