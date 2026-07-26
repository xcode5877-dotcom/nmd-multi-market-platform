import '../data/delivery_towns.dart';

/// Converts a zone fee in NIS (API number) to agora (integer fils/agorot).
/// Avoids keeping delivery money as a floating binary field in state.
int deliveryFeeNisToAgora(num? feeNis) {
  if (feeNis == null) return 0;
  // Exact for typical 0.5/1 shekel increments used by the platform.
  return (feeNis * 100).round();
}

double deliveryFeeAgoraToNis(int agora) => agora / 100.0;

Map<String, dynamic>? findZoneById(
  List<Map<String, dynamic>> zones,
  String? zoneId,
) {
  final id = zoneId?.trim() ?? '';
  if (id.isEmpty) return null;
  for (final z in zones) {
    if (z['id']?.toString() == id) return z;
  }
  return null;
}

/// Resolve a profile town name to exactly one active zone — never first-zone.
Map<String, dynamic>? resolveActiveZoneForTown({
  required String? town,
  required List<Map<String, dynamic>> activeZones,
}) {
  final t = town?.trim() ?? '';
  if (t.isEmpty || activeZones.isEmpty) return null;
  final zoneId = matchZoneIdForTown(activeZones, t);
  if (zoneId == null) return null;
  return findZoneById(activeZones, zoneId);
}

/// Default WhatsApp-style address template used by checkout.
String defaultAddressForTown(String town) {
  final t = town.trim();
  if (t.isEmpty) {
    return 'تواصل معي بالواتساب لتحديد الموقع';
  }
  return '$t - تواصل معي بالواتساب لتحديد الموقع';
}

bool isDefaultAddressTemplate(String address) {
  final a = address.trim();
  return a.endsWith('تواصل معي بالواتساب لتحديد الموقع') ||
      a == 'تواصل معي بالواتساب لتحديد الموقع';
}

/// True when the address clearly belongs to [areaName], or is a free-form
/// address that does not mention a different known town.
bool isAddressCompatibleWithArea({
  required String address,
  required String areaName,
  List<String> knownTowns = kNmdDeliveryTowns,
}) {
  final a = address.trim();
  final area = areaName.trim();
  if (a.isEmpty || area.isEmpty) return false;
  if (a.startsWith(area)) return true;
  if (isDefaultAddressTemplate(a) && a.contains(area)) return true;

  for (final town in knownTowns) {
    if (town == area) continue;
    if (a.contains(town)) return false;
  }
  // Custom address without another town name — treat as compatible.
  return true;
}

/// Adapt address after a checkout area change. Returns null when the customer
/// must enter a new address (incompatible with the new area).
String? adaptAddressForAreaChange({
  required String currentAddress,
  required String? previousAreaName,
  required String newAreaName,
  List<String> knownTowns = kNmdDeliveryTowns,
}) {
  final next = newAreaName.trim();
  if (next.isEmpty) return null;
  final current = currentAddress.trim();
  if (current.isEmpty) return defaultAddressForTown(next);

  final prev = previousAreaName?.trim() ?? '';
  if (isDefaultAddressTemplate(current)) {
    return defaultAddressForTown(next);
  }
  if (prev.isNotEmpty && current.startsWith(prev)) {
    return defaultAddressForTown(next);
  }
  if (isAddressCompatibleWithArea(
    address: current,
    areaName: next,
    knownTowns: knownTowns,
  )) {
    return current;
  }
  return null;
}

/// Per-checkout-session delivery area (order override).
///
/// [defaultTown] comes from [CustomerProfileCubit] / customer.defaultDeliveryTown.
/// [selectedAreaId] / [selectedAreaName] are the current order selection.
class CheckoutDeliveryAreaState {
  const CheckoutDeliveryAreaState({
    this.defaultTown,
    this.selectedAreaId,
    this.selectedAreaName,
    this.deliveryFeeAgora = 0,
    this.hasUserOverridden = false,
    this.isResolving = false,
    this.initialized = false,
    this.error,
    this.addressNeedsUpdate = false,
  });

  final String? defaultTown;
  final String? selectedAreaId;
  final String? selectedAreaName;

  /// Delivery fee for the selected zone in agora (integer money).
  final int deliveryFeeAgora;
  final bool hasUserOverridden;
  final bool isResolving;
  final bool initialized;
  final String? error;

  /// True when the street address must be updated after an area change.
  final bool addressNeedsUpdate;

  bool get hasSelection =>
      (selectedAreaId?.trim().isNotEmpty ?? false) &&
      (selectedAreaName?.trim().isNotEmpty ?? false);

  bool get isDefaultSelection {
    final def = defaultTown?.trim() ?? '';
    final sel = selectedAreaName?.trim() ?? '';
    return def.isNotEmpty && sel == def && !hasUserOverridden;
  }

  bool get canConfirmDelivery =>
      hasSelection && error == null && !addressNeedsUpdate;

  /// Canonical Create Order `delivery.deliveryAreaId` — selected town name
  /// (backend contract uses town string; zoneId is sent separately).
  String? get createOrderDeliveryAreaId {
    final name = selectedAreaName?.trim() ?? '';
    return name.isEmpty ? null : name;
  }

  CheckoutDeliveryAreaState copyWith({
    String? defaultTown,
    String? selectedAreaId,
    String? selectedAreaName,
    int? deliveryFeeAgora,
    bool? hasUserOverridden,
    bool? isResolving,
    bool? initialized,
    String? error,
    bool? addressNeedsUpdate,
    bool clearSelection = false,
    bool clearError = false,
  }) {
    return CheckoutDeliveryAreaState(
      defaultTown: defaultTown ?? this.defaultTown,
      selectedAreaId:
          clearSelection ? null : (selectedAreaId ?? this.selectedAreaId),
      selectedAreaName:
          clearSelection ? null : (selectedAreaName ?? this.selectedAreaName),
      deliveryFeeAgora: clearSelection
          ? 0
          : (deliveryFeeAgora ?? this.deliveryFeeAgora),
      hasUserOverridden: hasUserOverridden ?? this.hasUserOverridden,
      isResolving: isResolving ?? this.isResolving,
      initialized: initialized ?? this.initialized,
      error: clearError ? null : (error ?? this.error),
      addressNeedsUpdate: addressNeedsUpdate ?? this.addressNeedsUpdate,
    );
  }
}

/// Pure session controller for checkout delivery area.
/// Survives widget rebuilds; reset only for a new checkout session.
class CheckoutDeliveryAreaController {
  CheckoutDeliveryAreaState _state = const CheckoutDeliveryAreaState();

  CheckoutDeliveryAreaState get state => _state;

  /// Initialize once from profile default + active zones.
  /// No first-zone fallback when resolution fails.
  CheckoutDeliveryAreaState initializeFromProfile({
    required String? defaultTown,
    required List<Map<String, dynamic>> activeZones,
    int? fallbackFeeAgora,
  }) {
    final town = defaultTown?.trim() ?? '';
    final zone = resolveActiveZoneForTown(
      town: town,
      activeZones: activeZones,
    );
    if (zone == null) {
      _state = CheckoutDeliveryAreaState(
        defaultTown: town.isEmpty ? null : town,
        selectedAreaId: null,
        selectedAreaName: null,
        deliveryFeeAgora: 0,
        hasUserOverridden: false,
        initialized: true,
        error: town.isEmpty
            ? 'يرجى اختيار منطقة التوصيل'
            : 'يرجى اختيار منطقة التوصيل',
      );
      return _state;
    }
    final name = zone['name']?.toString().trim().isNotEmpty == true
        ? zone['name']!.toString().trim()
        : town;
    final fee = zone['fee'] is num
        ? deliveryFeeNisToAgora(zone['fee'] as num)
        : (fallbackFeeAgora ?? 0);
    _state = CheckoutDeliveryAreaState(
      defaultTown: town.isEmpty ? null : town,
      selectedAreaId: zone['id']?.toString(),
      selectedAreaName: name,
      deliveryFeeAgora: fee,
      hasUserOverridden: false,
      initialized: true,
    );
    return _state;
  }

  /// Profile default changed while checkout is open.
  /// Only applies when the customer has not manually overridden.
  CheckoutDeliveryAreaState syncProfileDefaultIfNotOverridden({
    required String? defaultTown,
    required List<Map<String, dynamic>> activeZones,
    int? fallbackFeeAgora,
  }) {
    if (!_state.initialized) {
      return initializeFromProfile(
        defaultTown: defaultTown,
        activeZones: activeZones,
        fallbackFeeAgora: fallbackFeeAgora,
      );
    }
    if (_state.hasUserOverridden) {
      _state = _state.copyWith(
        defaultTown: defaultTown?.trim().isNotEmpty == true
            ? defaultTown!.trim()
            : _state.defaultTown,
        clearError: true,
      );
      return _state;
    }
    return initializeFromProfile(
      defaultTown: defaultTown,
      activeZones: activeZones,
      fallbackFeeAgora: fallbackFeeAgora,
    );
  }

  /// Customer picks an area for this order only.
  CheckoutDeliveryAreaState selectArea({
    required String areaId,
    required List<Map<String, dynamic>> activeZones,
    int? fallbackFeeAgora,
  }) {
    final zone = findZoneById(activeZones, areaId);
    if (zone == null) {
      _state = _state.copyWith(
        error: 'يرجى اختيار منطقة التوصيل',
        clearSelection: true,
        hasUserOverridden: true,
      );
      return _state;
    }
    final name = zone['name']?.toString().trim() ?? '';
    final fee = zone['fee'] is num
        ? deliveryFeeNisToAgora(zone['fee'] as num)
        : (fallbackFeeAgora ?? 0);
    _state = CheckoutDeliveryAreaState(
      defaultTown: _state.defaultTown,
      selectedAreaId: zone['id']?.toString(),
      selectedAreaName: name,
      deliveryFeeAgora: fee,
      hasUserOverridden: true,
      initialized: true,
      addressNeedsUpdate: _state.addressNeedsUpdate,
    );
    return _state;
  }

  /// Re-validate current selection against refreshed active zones.
  /// Does not fall back to first zone; clears selection if deactivated.
  CheckoutDeliveryAreaState revalidateSelection({
    required List<Map<String, dynamic>> activeZones,
    int? fallbackFeeAgora,
  }) {
    if (!_state.hasSelection) {
      _state = _state.copyWith(error: 'يرجى اختيار منطقة التوصيل');
      return _state;
    }
    final zone = findZoneById(activeZones, _state.selectedAreaId);
    if (zone == null) {
      _state = _state.copyWith(
        clearSelection: true,
        hasUserOverridden: true,
        error: 'المنطقة لم تعد متاحة. يرجى اختيار منطقة أخرى',
        addressNeedsUpdate: false,
      );
      return _state;
    }
    final name = zone['name']?.toString().trim() ?? _state.selectedAreaName;
    final fee = zone['fee'] is num
        ? deliveryFeeNisToAgora(zone['fee'] as num)
        : (fallbackFeeAgora ?? _state.deliveryFeeAgora);
    _state = _state.copyWith(
      selectedAreaName: name,
      deliveryFeeAgora: fee,
      clearError: true,
    );
    return _state;
  }

  void markAddressNeedsUpdate(bool value) {
    _state = _state.copyWith(addressNeedsUpdate: value);
  }

  void resetForNewCheckout() {
    _state = const CheckoutDeliveryAreaState();
  }

  /// Build Create Order delivery map from checkout selection (not profile).
  Map<String, dynamic> buildCreateOrderDelivery({
    required String method,
    required int feeAgoraForOrder,
    required String addressText,
  }) {
    final areaId = createOrderDeliveryAreaId;
    return <String, dynamic>{
      'method': method,
      if (areaId != null) 'deliveryAreaId': areaId,
      if (_state.selectedAreaId != null) 'zoneId': _state.selectedAreaId,
      if (_state.selectedAreaName != null) 'zoneName': _state.selectedAreaName,
      'fee': deliveryFeeAgoraToNis(feeAgoraForOrder),
      'addressText': addressText,
    };
  }

  String? get createOrderDeliveryAreaId => _state.createOrderDeliveryAreaId;
}
