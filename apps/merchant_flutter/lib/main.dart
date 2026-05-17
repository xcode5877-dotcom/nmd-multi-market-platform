import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/api/merchant_api_client.dart';
import 'core/session/merchant_session_store.dart';
import 'models/merchant_session.dart';
import 'ui/pages/merchant_login_page.dart';
import 'ui/pages/order_dashboard_page.dart';
import 'ui/theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MerchantApp());
}

class MerchantApp extends StatelessWidget {
  const MerchantApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NMD Merchant',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const MerchantSessionGate(),
    );
  }
}

class MerchantSessionGate extends StatefulWidget {
  const MerchantSessionGate({super.key});

  @override
  State<MerchantSessionGate> createState() => _MerchantSessionGateState();
}

class _MerchantSessionGateState extends State<MerchantSessionGate> {
  late final MerchantSessionStore _sessionStore;
  late final MerchantApiClient _api;
  MerchantSession? _session;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _sessionStore = MerchantSessionStore();
    _api = MerchantApiClient(_sessionStore);
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await _sessionStore.readSession();
    if (!mounted) return;
    setState(() {
      _session = session;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator.adaptive()),
      );
    }

    final session = _session;
    if (session == null) {
      return MerchantLoginPage(
        api: _api,
        onLoggedIn: (value) => setState(() => _session = value),
      );
    }

    return OrderDashboardPage(
      api: _api,
      sessionStore: _sessionStore,
      session: session,
      onLoggedOut: () => setState(() => _session = null),
    );
  }
}
