import 'package:flutter_test/flutter_test.dart';

import 'package:customer_flutter/features/contest/presentation/widgets/contest_popup_sheet.dart';

void main() {
  group('ContestSessionMemory auto-popup gate', () {
    const contestId = 'contest-test-1';

    tearDown(() {
      ContestSessionMemory.dismiss(contestId);
      ContestSessionMemory.markPresented(contestId);
    });

    test('markPresented prevents repeat presentation in same session', () {
      expect(ContestSessionMemory.wasPresented(contestId), isFalse);
      ContestSessionMemory.markPresented(contestId);
      expect(ContestSessionMemory.wasPresented(contestId), isTrue);
    });

    test('dismiss and presented are independent gates', () {
      ContestSessionMemory.dismiss('contest-dismiss-only');
      expect(ContestSessionMemory.isDismissed('contest-dismiss-only'), isTrue);
      expect(ContestSessionMemory.wasPresented('contest-dismiss-only'), isFalse);
    });
  });
}
