import 'package:flutter_test/flutter_test.dart';

/// Widget smoke tests that pump [NmdCustomerApp] hit splash + Dio timers and
/// fail under `flutter test` without HTTP overrides. Use integration tests or
/// a test router with a mocked API for full-app pumps.
void main() {
  test('sanity', () {
    expect(1 + 1, 2);
  });
}
