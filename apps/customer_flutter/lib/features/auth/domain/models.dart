class CheckPhoneResult {
  const CheckPhoneResult({required this.exists});

  final bool exists;
}

class OtpStartResult {
  const OtpStartResult({
    required this.ok,
    this.sentVia,
    this.devCode,
    this.error,
  });

  final bool ok;
  final String? sentVia;
  final String? devCode;
  final String? error;
}

class OtpVerifyResult {
  const OtpVerifyResult({
    required this.token,
    this.isNewUser = false,
  });

  final String token;
  final bool isNewUser;
}

/// Result of `GET /customer/me` when a valid customer JWT is stored.
class CustomerMeResult {
  const CustomerMeResult({
    required this.phone,
    this.name,
  });

  final String phone;
  final String? name;
}
