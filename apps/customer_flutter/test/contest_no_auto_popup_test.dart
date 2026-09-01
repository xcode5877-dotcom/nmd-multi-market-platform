import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('HomePage passive navigation', () {
    final homeSrc = File(
      'lib/features/catalog/presentation/pages/home_page.dart',
    ).readAsStringSync();

    test('does not import contest popup sheet', () {
      expect(homeSrc.contains('contest_popup_sheet.dart'), isFalse);
    });

    test('does not schedule automatic contest popup', () {
      expect(homeSrc.contains('showContestPopupIfNeeded'), isFalse);
      expect(homeSrc.contains('showContestParticipationSheet'), isFalse);
      expect(homeSrc.contains('_scheduleContestPopup'), isFalse);
      expect(homeSrc.contains('_contestPopupAttempted'), isFalse);
    });
  });

  group('contest_popup_sheet public API', () {
    final sheetSrc = File(
      'lib/features/contest/presentation/widgets/contest_popup_sheet.dart',
    ).readAsStringSync();

    test('does not expose passive auto-popup entrypoint', () {
      expect(sheetSrc.contains('showContestPopupIfNeeded'), isFalse);
    });

    test('exposes explicit user-initiated sheet entrypoint', () {
      expect(sheetSrc.contains('showContestParticipationSheet'), isTrue);
    });
  });
}
