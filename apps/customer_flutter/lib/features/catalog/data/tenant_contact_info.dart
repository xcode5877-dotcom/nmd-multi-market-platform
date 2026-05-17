import 'dart:convert';

/// WhatsApp / phone for tenant — `tenant.whatsappPhone`, `tenant.phone`, and `branding.*` (web parity).
class TenantContactInfo {
  const TenantContactInfo({
    this.whatsappDigits,
    this.phoneDigits,
  });

  /// Digits only (for `wa.me` / `tel:`), international form without +.
  final String? whatsappDigits;

  /// Voice call; if absent, [telDigits] may fall back to [whatsappDigits].
  final String? phoneDigits;

  bool get hasWhatsApp => whatsappDigits != null && whatsappDigits!.isNotEmpty;

  /// Prefer dedicated phone, else WhatsApp number (web: `phone ?? whatsapp`).
  String? get telDigits {
    if (phoneDigits != null && phoneDigits!.isNotEmpty) return phoneDigits;
    return whatsappDigits;
  }
}

/// Service/product row may omit numbers — inherit store (office) contact.
TenantContactInfo mergeContactWithOffice(
    TenantContactInfo? product, TenantContactInfo office) {
  if (product == null) return office;
  final hasWa =
      product.whatsappDigits != null && product.whatsappDigits!.isNotEmpty;
  final hasPh = product.phoneDigits != null && product.phoneDigits!.isNotEmpty;
  if (!hasWa && !hasPh) return office;
  return TenantContactInfo(
    whatsappDigits: hasWa ? product.whatsappDigits : office.whatsappDigits,
    phoneDigits: hasPh ? product.phoneDigits : office.phoneDigits,
  );
}

/// Whether the store has any number usable for WhatsApp or voice (after normalization).
bool tenantHasDialableContact(TenantContactInfo office) {
  final o = mergeContactWithOffice(null, office);
  return _digits(o.whatsappDigits).isNotEmpty ||
      _digits(o.telDigits).isNotEmpty;
}

Map<String, dynamic> _brandingMap(dynamic raw) {
  if (raw is Map) return Map<String, dynamic>.from(raw);
  if (raw is String && raw.trim().isNotEmpty) {
    try {
      final d = jsonDecode(raw);
      if (d is Map) return Map<String, dynamic>.from(d);
    } catch (_) {}
  }
  return {};
}

String _digits(dynamic v) {
  final s = v?.toString() ?? '';
  return s.replaceAll(RegExp(r'\D'), '');
}

/// Israeli mobiles: `05…` / `5…` → `9725…` for WhatsApp `wa.me`.
String _normalizeIsraeliMsisdn(String d) {
  if (d.isEmpty) return d;
  if (d.startsWith('972') && d.length >= 11) return d;
  if (d.startsWith('0') && d.length >= 9 && d.length <= 11) {
    return '972${d.substring(1)}';
  }
  if (d.startsWith('5') && (d.length == 8 || d.length == 9)) {
    return '972$d';
  }
  return d;
}

TenantContactInfo tenantContactFromTenantMap(Map<String, dynamic> tenant) {
  final branding = _brandingMap(tenant['branding']);

  final waRaw = _digits(
    branding['whatsappPhone'] ??
        branding['whatsapp_phone'] ??
        branding['whatsapp'] ??
        branding['contactWhatsapp'] ??
        tenant['whatsappPhone'] ??
        tenant['whatsapp_phone'] ??
        tenant['whatsapp'],
  );
  final phRaw = _digits(
    branding['phone'] ??
        branding['phoneNumber'] ??
        branding['contactPhone'] ??
        branding['officePhone'] ??
        branding['mainPhone'] ??
        tenant['phone'] ??
        tenant['phoneNumber'] ??
        tenant['mobile'],
  );

  final wa = _normalizeIsraeliMsisdn(waRaw);
  final ph = phRaw.isNotEmpty ? _normalizeIsraeliMsisdn(phRaw) : '';

  // If branding WhatsApp is empty, use main phone for wa.me (same number is common).
  final waEffective = wa.isNotEmpty ? wa : (ph.isNotEmpty ? ph : '');

  return TenantContactInfo(
    whatsappDigits: waEffective.isNotEmpty ? waEffective : null,
    phoneDigits: ph.isNotEmpty ? ph : null,
  );
}
