import 'models.dart';

abstract interface class AuthRepository {
  Future<CheckPhoneResult> checkPhone(String phone);
  Future<OtpStartResult> startOtp(String phone);
  Future<OtpVerifyResult> verifyOtp({
    required String phone,
    required String code,
    String? name,
  });

  /// Returns profile when `customer` JWT is present and valid; otherwise `null`.
  Future<CustomerMeResult?> fetchCurrentCustomer();

  /// Updates display name after OTP verification (existing `/customer/profile`).
  Future<void> updateCustomerName(String name);

  /// Saves profile fields after registration or one-time setup.
  Future<void> updateCustomerProfile({
    required String name,
    String? defaultDeliveryTown,
    String source = 'profile',
  });
}
