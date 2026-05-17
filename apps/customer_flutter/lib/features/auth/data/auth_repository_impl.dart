import '../../../core/network/token_storage.dart';
import '../domain/auth_repository.dart';
import '../domain/models.dart';
import 'auth_remote_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl({
    required AuthRemoteDataSource remote,
    required TokenStorage tokenStorage,
  })  : _remote = remote,
        _tokenStorage = tokenStorage;

  final AuthRemoteDataSource _remote;
  final TokenStorage _tokenStorage;

  @override
  Future<CheckPhoneResult> checkPhone(String phone) {
    return _remote.checkPhone(phone);
  }

  @override
  Future<OtpStartResult> startOtp(String phone) {
    return _remote.startOtp(phone);
  }

  @override
  Future<OtpVerifyResult> verifyOtp({
    required String phone,
    required String code,
    String? name,
  }) async {
    final result =
        await _remote.verifyOtp(phone: phone, code: code, name: name);
    await _tokenStorage.saveCustomerToken(result.token);
    return result;
  }

  @override
  Future<CustomerMeResult?> fetchCurrentCustomer() async {
    final t = await _tokenStorage.getCustomerToken();
    if (t == null || t.trim().isEmpty) return null;
    return _remote.fetchCurrentCustomer();
  }
}
