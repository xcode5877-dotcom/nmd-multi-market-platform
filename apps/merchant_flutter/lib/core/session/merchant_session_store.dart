import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/merchant_session.dart';

class MerchantSessionStore {
  MerchantSessionStore({
    FlutterSecureStorage? secureStorage,
    SharedPreferencesAsync? preferences,
  })  : _secureStorage = secureStorage ?? const FlutterSecureStorage(),
        _preferences = preferences ?? SharedPreferencesAsync();

  static const accessTokenKey = 'nmd-access-token';
  static const tenantIdKey = 'nmd-merchant-tenant-id';
  static const tenantSlugKey = 'nmd-merchant-tenant-slug';
  static const marketSlugKey = 'nmd-merchant-market-slug';
  static const userEmailKey = 'nmd-merchant-user-email';
  static const printedOrderIdsKey = 'nmd-merchant-printed-order-ids';

  final FlutterSecureStorage _secureStorage;
  final SharedPreferencesAsync _preferences;

  Future<String?> readAccessToken() => _secureStorage.read(key: accessTokenKey);

  Future<MerchantSession?> readSession() async {
    final token = await _secureStorage.read(key: accessTokenKey);
    final tenantId = await _preferences.getString(tenantIdKey);
    if (token == null ||
        token.isEmpty ||
        tenantId == null ||
        tenantId.isEmpty) {
      return null;
    }
    return MerchantSession(
      accessToken: token,
      tenantId: tenantId,
      marketSlug: await _preferences.getString(marketSlugKey) ?? '',
      tenantSlug: await _preferences.getString(tenantSlugKey),
      userEmail: await _preferences.getString(userEmailKey),
    );
  }

  Future<void> saveSession(MerchantSession session) async {
    await _secureStorage.write(key: accessTokenKey, value: session.accessToken);
    await _preferences.setString(tenantIdKey, session.tenantId);
    await _preferences.setString(marketSlugKey, session.marketSlug);
    if (session.tenantSlug != null && session.tenantSlug!.isNotEmpty) {
      await _preferences.setString(tenantSlugKey, session.tenantSlug!);
    }
    if (session.userEmail != null && session.userEmail!.isNotEmpty) {
      await _preferences.setString(userEmailKey, session.userEmail!);
    }
  }

  Future<void> clearSession() async {
    await _secureStorage.delete(key: accessTokenKey);
    await _preferences.remove(tenantIdKey);
    await _preferences.remove(tenantSlugKey);
    await _preferences.remove(marketSlugKey);
    await _preferences.remove(userEmailKey);
    await _preferences.remove(printedOrderIdsKey);
  }

  Future<Set<String>> readPrintedOrderIds() async {
    final ids = await _preferences.getStringList(printedOrderIdsKey);
    return (ids ?? const <String>[]).toSet();
  }

  Future<void> savePrintedOrderIds(Set<String> ids) async {
    await _preferences.setStringList(printedOrderIdsKey, ids.toList()..sort());
  }
}
