import 'package:dio/dio.dart';

import '../../../api/api_base.dart';
import '../domain/models.dart';

class AuthRemoteDataSource {
  const AuthRemoteDataSource(this._dio);

  final Dio _dio;

  Future<CustomerMeResult?> fetchCurrentCustomer() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/customer/me',
      options: Options(headers: const {'Accept': 'application/json'}),
    );
    final data = response.data;
    if (data == null) return null;
    final phone = data['phone']?.toString().trim() ?? '';
    if (phone.isEmpty) return null;
    return CustomerMeResult(
      phone: phone,
      id: data['id']?.toString(),
      name: data['name']?.toString(),
    );
  }

  Future<CheckPhoneResult> checkPhone(String phone) async {
    final phoneRaw = phone;
    nmdDebugLog(
        '[AuthRemoteDataSource] checkPhone query phone (raw as typed): "$phoneRaw"');
    final response = await _dio.get<Map<String, dynamic>>(
      '/customer/auth/check-phone',
      queryParameters: {'phone': phoneRaw},
      options: Options(
          headers: const {'Accept': 'application/json, text/plain, */*'}),
    );
    return CheckPhoneResult(
      exists: response.data?['exists'] == true,
    );
  }

  Future<OtpStartResult> startOtp(String phone) async {
    final payload = <String, dynamic>{'phone': phone};
    nmdDebugLog('[AuthRemoteDataSource] startOtp request body: $payload');
    final response = await _dio.post<Map<String, dynamic>>(
      '/customer/auth/start',
      data: payload,
      options: Options(
          headers: const {'Accept': 'application/json, text/plain, */*'}),
    );
    final data = response.data ?? <String, dynamic>{};
    return OtpStartResult(
      ok: data['ok'] == true,
      sentVia: data['sentVia']?.toString(),
      devCode: data['devCode']?.toString(),
      error: data['error']?.toString(),
    );
  }

  Future<OtpVerifyResult> verifyOtp({
    required String phone,
    required String code,
    String? name,
  }) async {
    final payload = <String, dynamic>{
      'phone': phone,
      'code': code,
    };
    if (name != null && name.trim().isNotEmpty) {
      payload['name'] = name.trim();
    }
    nmdDebugLog(
      '[AuthRemoteDataSource] verifyOtp phone=${payload['phone']} (code redacted)',
    );

    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/verify-otp',
      data: payload,
      options: Options(
          headers: const {'Accept': 'application/json, text/plain, */*'}),
    );

    final data = response.data ?? <String, dynamic>{};
    final token = (data['token'] ?? data['accessToken'])?.toString();
    final user = data['user'];
    final userId = user is Map ? user['id']?.toString() : null;
    if (token == null || token.isEmpty) {
      throw const FormatException('Token missing from verify response');
    }
    if (userId == null || userId.isEmpty) {
      throw const FormatException('User object missing from verify response');
    }
    return OtpVerifyResult(
      token: token,
      isNewUser: data['isNewUser'] == true,
    );
  }

  Future<void> updateCustomerName(String name) async {
    await _dio.patch<Map<String, dynamic>>(
      '/customer/profile',
      data: <String, dynamic>{'name': name.trim()},
      options: Options(
        headers: const {'Accept': 'application/json, text/plain, */*'},
      ),
    );
  }
}
