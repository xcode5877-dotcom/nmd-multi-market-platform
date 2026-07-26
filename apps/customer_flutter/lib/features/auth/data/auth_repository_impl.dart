import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show debugPrint;

import '../../../core/auth/app_review_demo_access.dart';
import '../../../core/debug/nmd_post_login_trace.dart';
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
    if (isAppReviewDemoAccount(phone)) {
      logAppleReviewAuthBypass('checkPhone skipped');
      return Future.value(const CheckPhoneResult(exists: true));
    }
    return _remote.checkPhone(phone);
  }

  /// Apple App Review demo access only — never hit OTP delivery (WhatsApp/SMS).
  @override
  Future<OtpStartResult> startOtp(String phone) {
    if (isAppReviewDemoAccount(phone)) {
      logAppleReviewAuthBypass('startOtp skipped');
      return Future.value(
        const OtpStartResult(ok: true, sentVia: 'app_review'),
      );
    }
    return _remote.startOtp(phone);
  }

  @override
  Future<OtpVerifyResult> verifyOtp({
    required String phone,
    required String code,
    String? name,
  }) async {
    final apiPhone = isAppReviewDemoAccount(phone)
        ? normalizeAppReviewDemoPhone(phone)
        : phone;
    if (isAppReviewDemoAccount(phone)) {
      logAppleReviewAuthBypass('verifyOtp apiPhone=$apiPhone');
    }
    try {
      final result = await _remote.verifyOtp(
        phone: apiPhone,
        code: code,
        name: name,
      );
      await _tokenStorage.saveCustomerToken(result.token);
      nmdPostLoginTrace('TOKEN_SAVED');
      return result;
    } catch (e, st) {
      if (isAppReviewDemoAccount(phone)) {
        debugPrint('APPLE_REVIEW_BYPASS verifyOtp failed: $e\n$st');
      }
      rethrow;
    }
  }

  @override
  Future<CustomerMeResult?> fetchCurrentCustomer() async {
    final t = await _tokenStorage.getCustomerToken();
    if (t == null || t.trim().isEmpty) return null;
    try {
      return await _remote.fetchCurrentCustomer();
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await _tokenStorage.clear();
        return null;
      }
      rethrow;
    }
  }

  @override
  Future<void> updateCustomerName(String name) {
    return _remote.updateCustomerName(name);
  }

  @override
  Future<void> updateCustomerProfile({
    required String name,
    String? defaultDeliveryTown,
    String source = 'profile',
  }) {
    return _remote.updateCustomerProfile(
      name: name,
      defaultDeliveryTown: defaultDeliveryTown,
      source: source,
    );
  }
}
