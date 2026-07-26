import '../data/delivery_towns.dart';

/// Derived checkout delivery binding from the profile primary area.
/// Never stores a separate "selected" area — only resolves zone metadata.
class CheckoutDeliveryAreaResolution {
  const CheckoutDeliveryAreaResolution({
    required this.profileTown,
    required this.zoneId,
    required this.zoneName,
    required this.hasProfileTown,
    required this.zoneMatched,
  });

  final String profileTown;
  final String? zoneId;
  final String? zoneName;
  final bool hasProfileTown;
  final bool zoneMatched;

  bool get canDeliver => hasProfileTown && zoneMatched && zoneId != null;
}

CheckoutDeliveryAreaResolution resolveCheckoutDeliveryArea({
  required String? profileTown,
  required List<Map<String, dynamic>> zones,
}) {
  final town = profileTown?.trim() ?? '';
  if (town.isEmpty) {
    return const CheckoutDeliveryAreaResolution(
      profileTown: '',
      zoneId: null,
      zoneName: null,
      hasProfileTown: false,
      zoneMatched: false,
    );
  }
  final zoneId = matchZoneIdForTown(zones, town);
  Map<String, dynamic>? zone;
  if (zoneId != null) {
    for (final z in zones) {
      if (z['id']?.toString() == zoneId) {
        zone = z;
        break;
      }
    }
  }
  return CheckoutDeliveryAreaResolution(
    profileTown: town,
    zoneId: zoneId,
    zoneName: zone?['name']?.toString() ?? town,
    hasProfileTown: true,
    zoneMatched: zoneId != null,
  );
}
