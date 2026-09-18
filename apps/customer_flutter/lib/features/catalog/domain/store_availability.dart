/// Shared store open/closed resolution for customer catalog surfaces.
///
/// Prefer this over reading a single API field — `operationalStatus` and
/// admin overrides can disagree across endpoints.
class StoreAvailability {
  const StoreAvailability({
    required this.isClosed,
    required this.reason,
    required this.operationalStatus,
    required this.forceClosedByAdmin,
  });

  final bool isClosed;
  final StoreClosedReason reason;
  final String operationalStatus;
  final bool forceClosedByAdmin;

  /// Resolves closed state from a tenant details map (merged API payload).
  factory StoreAvailability.fromTenantMap(Map<String, dynamic>? tenant) {
    final map = tenant ?? const <String, dynamic>{};
    final status =
        (map['operationalStatus']?.toString() ?? 'closed').trim().toLowerCase();
    final override = map['overrideStatus']?.toString().trim().toUpperCase();
    final forceFlag = map['forceClosed'] == true;
    final adminForced = forceFlag || override == 'FORCE_CLOSED';

    if (adminForced) {
      return StoreAvailability(
        isClosed: true,
        reason: StoreClosedReason.forceClosed,
        operationalStatus: status,
        forceClosedByAdmin: true,
      );
    }
    if (status == 'closed') {
      return StoreAvailability(
        isClosed: true,
        reason: StoreClosedReason.closedBySchedule,
        operationalStatus: status,
        forceClosedByAdmin: false,
      );
    }
    return StoreAvailability(
      isClosed: false,
      reason: StoreClosedReason.none,
      operationalStatus: status.isEmpty ? 'open' : status,
      forceClosedByAdmin: false,
    );
  }

  String get bannerTitleAr => switch (reason) {
        StoreClosedReason.forceClosed => 'المحل مغلق حالياً',
        StoreClosedReason.closedBySchedule => 'المحل مغلق حالياً',
        StoreClosedReason.none => '',
      };

  String get bannerBodyAr => switch (reason) {
        StoreClosedReason.forceClosed =>
          'الإضافة إلى السلة غير متاحة لأن المحل مغلق من الإدارة. يمكنك تصفّح الكميات والعودة لاحقاً.',
        StoreClosedReason.closedBySchedule =>
          'الإضافة إلى السلة غير متاحة خارج ساعات العمل. يمكنك تصفّح الكميات والعودة عند الفتح.',
        StoreClosedReason.none => '',
      };

  String get addToCartDisabledLabelAr => 'المحل مغلق';
}

enum StoreClosedReason {
  none,
  closedBySchedule,
  forceClosed,
}
