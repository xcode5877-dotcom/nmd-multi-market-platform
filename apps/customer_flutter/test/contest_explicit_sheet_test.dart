import 'package:customer_flutter/core/network/token_storage.dart';
import 'package:customer_flutter/features/contest/presentation/widgets/contest_popup_sheet.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

/// In-memory token storage for widget tests (avoids platform secure storage).
class TestTokenStorage extends TokenStorage {
  TestTokenStorage() : super();

  String? _token;

  @override
  Future<String?> getCustomerToken() async => _token;

  @override
  Future<void> saveCustomerToken(String token) async {
    _token = token;
  }

  @override
  Future<void> clear() async {
    _token = null;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  testWidgets('explicit showContestParticipationSheet opens participation UI',
      (tester) async {
    final contest = ActiveContestVm(
      id: 'contest-explicit-1',
      title: 'مسابقة تجريبية',
      description: 'وصف',
      type: 'QUESTION',
      isPrediction: false,
      options: [
        {'id': 'a', 'label': 'خيار أ'},
      ],
      teamAName: 'أ',
      teamBName: 'ب',
    );

    await tester.pumpWidget(
      RepositoryProvider<Dio>(
        create: (_) => Dio(),
        child: RepositoryProvider<TokenStorage>(
          create: (_) => TestTokenStorage(),
          child: MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(
                  child: ElevatedButton(
                    onPressed: () async {
                      await showContestParticipationSheet(
                        context,
                        contest: contest,
                      );
                    },
                    child: const Text('فتح المسابقة'),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('فتح المسابقة'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();

    expect(find.text('مسابقة تجريبية'), findsOneWidget);
    expect(find.text('إغلاق'), findsOneWidget);
    expect(find.text('إرسال'), findsOneWidget);
  });
}
