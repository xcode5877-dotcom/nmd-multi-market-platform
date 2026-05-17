class MerchantSession {
  const MerchantSession({
    required this.accessToken,
    required this.tenantId,
    required this.marketSlug,
    this.tenantSlug,
    this.userEmail,
  });

  final String accessToken;
  final String tenantId;
  final String marketSlug;
  final String? tenantSlug;
  final String? userEmail;
}
