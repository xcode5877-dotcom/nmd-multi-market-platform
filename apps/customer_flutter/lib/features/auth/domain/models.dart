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
    this.deliveryFailed = false,
  });

  final bool ok;
  final String? sentVia;
  final String? devCode;
  final String? error;
  final bool deliveryFailed;

  /// True when the server accepted the request and a delivery channel (or
  /// approved bypass) actually succeeded.
  bool get deliveredSuccessfully {
    if (!ok || deliveryFailed) return false;
    final via = sentVia?.trim().toLowerCase();
    if (via == null || via.isEmpty || via == 'none') return false;
    return true;
  }
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
    this.id,
    this.name,
  });

  final String phone;
  final String? id;
  final String? name;
}
