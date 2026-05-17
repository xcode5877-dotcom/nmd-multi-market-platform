import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  TokenStorage({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  static const _customerTokenKey = 'nmd-customer-token';

  final FlutterSecureStorage _secureStorage;
  String? _memoryCustomerToken;

  Future<String?> getCustomerToken() async {
    if (_memoryCustomerToken != null && _memoryCustomerToken!.isNotEmpty) {
      return _memoryCustomerToken;
    }
    final token = await _secureStorage.read(key: _customerTokenKey);
    _memoryCustomerToken = token;
    return token;
  }

  Future<void> saveCustomerToken(String token) async {
    _memoryCustomerToken = token;
    await _secureStorage.write(key: _customerTokenKey, value: token);
  }

  Future<void> clear() async {
    _memoryCustomerToken = null;
    await _secureStorage.delete(key: _customerTokenKey);
  }
}
