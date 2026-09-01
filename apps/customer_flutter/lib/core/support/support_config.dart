/// Live Support Center configuration from `GET /config/support` / `/app-config`.
///
/// Future channels (email, telegram, messenger, live_chat) can be added via
/// [channels] without redesigning the customer UI.
class SupportConfig {
  const SupportConfig({
    required this.supportPhone,
    required this.supportWhatsapp,
    required this.supportEnabled,
    required this.phoneEnabled,
    required this.whatsappEnabled,
    required this.workingHours,
    required this.supportTitle,
    required this.supportDescription,
    required this.defaultWhatsappMessage,
    this.channels = const [],
    this.floatingSupportEnabled = true,
    this.floatingSupportAnimationEnabled = true,
    this.floatingSupportPosition = FloatingSupportPosition.logicalEnd,
  });

  final String supportPhone;
  final String supportWhatsapp;
  final bool supportEnabled;
  final bool phoneEnabled;
  final bool whatsappEnabled;
  final String workingHours;
  final String supportTitle;
  final String supportDescription;
  final String defaultWhatsappMessage;
  final List<SupportChannel> channels;

  /// When false, hide the global floating capsule (Account → مركز الدعم remains).
  final bool floatingSupportEnabled;

  /// Optional subtle breathe animation on the floating capsule.
  final bool floatingSupportAnimationEnabled;

  /// Capsule horizontal placement (directional — RTL-safe).
  final FloatingSupportPosition floatingSupportPosition;

  /// Empty / disabled — used only when JSON is explicitly null.
  static const SupportConfig fallback = SupportConfig(
    supportPhone: '',
    supportWhatsapp: '',
    supportEnabled: false,
    phoneEnabled: false,
    whatsappEnabled: false,
    workingHours: '',
    supportTitle: 'كيف يمكننا مساعدتك؟',
    supportDescription:
        'فريق Now Market جاهز لمساعدتك والإجابة عن استفساراتك',
    defaultWhatsappMessage:
        'مرحبًا،\n\nأحتاج إلى المساعدة في تطبيق Now Market.',
    channels: [],
    floatingSupportEnabled: true,
    floatingSupportAnimationEnabled: true,
    floatingSupportPosition: FloatingSupportPosition.logicalEnd,
  );

  /// Production-safe provisional config while loading / offline (no dart-defines).
  /// Missing API fields must never leave the hub permanently blank.
  static const SupportConfig safeDefault = SupportConfig(
    supportPhone: '0548289765',
    supportWhatsapp: '0548289765',
    supportEnabled: true,
    phoneEnabled: true,
    whatsappEnabled: true,
    workingHours: 'يوميًا من 08:00 حتى 22:00',
    supportTitle: 'كيف يمكننا مساعدتك؟',
    supportDescription:
        'فريق Now Market جاهز لمساعدتك والإجابة عن استفساراتك',
    defaultWhatsappMessage:
        'مرحبًا،\n\nأحتاج إلى المساعدة في تطبيق Now Market.',
    channels: [],
    floatingSupportEnabled: true,
    floatingSupportAnimationEnabled: true,
    floatingSupportPosition: FloatingSupportPosition.logicalEnd,
  );

  bool get isPhoneAvailable =>
      supportEnabled && phoneEnabled && digitsForDial(supportPhone).isNotEmpty;

  bool get isWhatsappAvailable =>
      supportEnabled &&
      whatsappEnabled &&
      digitsForWhatsApp(supportWhatsapp).isNotEmpty;

  bool get hasAnyChannel => isPhoneAvailable || isWhatsappAvailable;

  /// Capsule may appear when support is on, floating is on, and a channel exists.
  bool get showFloatingCapsule =>
      supportEnabled && floatingSupportEnabled && hasAnyChannel;

  factory SupportConfig.fromJson(Map<String, dynamic>? json) {
    if (json == null) return SupportConfig.fallback;
    final channelsRaw = json['channels'];
    final channels = <SupportChannel>[];
    if (channelsRaw is List) {
      for (final c in channelsRaw) {
        if (c is Map) {
          channels.add(
            SupportChannel.fromJson(Map<String, dynamic>.from(c)),
          );
        }
      }
    }
    return SupportConfig(
      supportPhone: (json['supportPhone'] ?? '').toString().trim(),
      supportWhatsapp: (json['supportWhatsapp'] ?? '').toString().trim(),
      supportEnabled: json['supportEnabled'] != false,
      phoneEnabled: json['phoneEnabled'] != false,
      whatsappEnabled: json['whatsappEnabled'] != false,
      workingHours: (json['workingHours'] ?? '').toString().trim(),
      supportTitle: (json['supportTitle'] ?? 'كيف يمكننا مساعدتك؟')
          .toString()
          .trim(),
      supportDescription: (json['supportDescription'] ??
              'فريق Now Market جاهز لمساعدتك والإجابة عن استفساراتك')
          .toString()
          .trim(),
      defaultWhatsappMessage: (json['defaultWhatsappMessage'] ??
              'مرحبًا،\n\nأحتاج إلى المساعدة في تطبيق Now Market.')
          .toString(),
      channels: channels,
      // Backwards compatible: missing/null keys → true (never treat missing as false).
      floatingSupportEnabled: _boolOrDefault(
        json['floatingSupportEnabled'],
        defaultValue: true,
      ),
      floatingSupportAnimationEnabled: _boolOrDefault(
        json['floatingSupportAnimationEnabled'],
        defaultValue: true,
      ),
      floatingSupportPosition: FloatingSupportPosition.parse(
        json['floatingSupportPosition']?.toString(),
      ),
    );
  }

  /// Distinguishes missing/null (→ [defaultValue]) from explicit `false`.
  static bool _boolOrDefault(Object? raw, {required bool defaultValue}) {
    if (raw == null) return defaultValue;
    if (raw is bool) return raw;
    final s = raw.toString().trim().toLowerCase();
    if (s == 'true' || s == '1') return true;
    if (s == 'false' || s == '0') return false;
    return defaultValue;
  }

  Map<String, dynamic> toJson() => {
        'supportPhone': supportPhone,
        'supportWhatsapp': supportWhatsapp,
        'supportEnabled': supportEnabled,
        'phoneEnabled': phoneEnabled,
        'whatsappEnabled': whatsappEnabled,
        'workingHours': workingHours,
        'supportTitle': supportTitle,
        'supportDescription': supportDescription,
        'defaultWhatsappMessage': defaultWhatsappMessage,
        'channels': channels.map((c) => c.toJson()).toList(),
        'floatingSupportEnabled': floatingSupportEnabled,
        'floatingSupportAnimationEnabled': floatingSupportAnimationEnabled,
        'floatingSupportPosition': floatingSupportPosition.wire,
      };

  SupportConfig copyWith({
    String? supportPhone,
    String? supportWhatsapp,
    bool? supportEnabled,
    bool? phoneEnabled,
    bool? whatsappEnabled,
    String? workingHours,
    String? supportTitle,
    String? supportDescription,
    String? defaultWhatsappMessage,
    List<SupportChannel>? channels,
    bool? floatingSupportEnabled,
    bool? floatingSupportAnimationEnabled,
    FloatingSupportPosition? floatingSupportPosition,
  }) {
    return SupportConfig(
      supportPhone: supportPhone ?? this.supportPhone,
      supportWhatsapp: supportWhatsapp ?? this.supportWhatsapp,
      supportEnabled: supportEnabled ?? this.supportEnabled,
      phoneEnabled: phoneEnabled ?? this.phoneEnabled,
      whatsappEnabled: whatsappEnabled ?? this.whatsappEnabled,
      workingHours: workingHours ?? this.workingHours,
      supportTitle: supportTitle ?? this.supportTitle,
      supportDescription: supportDescription ?? this.supportDescription,
      defaultWhatsappMessage:
          defaultWhatsappMessage ?? this.defaultWhatsappMessage,
      channels: channels ?? this.channels,
      floatingSupportEnabled:
          floatingSupportEnabled ?? this.floatingSupportEnabled,
      floatingSupportAnimationEnabled: floatingSupportAnimationEnabled ??
          this.floatingSupportAnimationEnabled,
      floatingSupportPosition:
          floatingSupportPosition ?? this.floatingSupportPosition,
    );
  }
}

/// Horizontal placement for the floating support capsule (directional).
enum FloatingSupportPosition {
  logicalStart,
  logicalEnd;

  String get wire => switch (this) {
        FloatingSupportPosition.logicalStart => 'logicalStart',
        FloatingSupportPosition.logicalEnd => 'logicalEnd',
      };

  static FloatingSupportPosition parse(String? raw) {
    switch ((raw ?? '').trim().toLowerCase()) {
      case 'logicalstart':
      case 'logical_start':
      case 'start':
        return FloatingSupportPosition.logicalStart;
      case 'logicalend':
      case 'logical_end':
      case 'end':
      default:
        // Default: logicalEnd — clears the centered cart pill on small phones.
        return FloatingSupportPosition.logicalEnd;
    }
  }
}

class SupportChannel {
  const SupportChannel({
    required this.id,
    required this.type,
    required this.enabled,
    this.label,
    this.value,
  });

  final String id;
  final SupportChannelType type;
  final bool enabled;
  final String? label;
  final String? value;

  factory SupportChannel.fromJson(Map<String, dynamic> json) {
    return SupportChannel(
      id: (json['id'] ?? '').toString(),
      type: SupportChannelType.parse(json['type']?.toString()),
      enabled: json['enabled'] != false,
      label: json['label']?.toString(),
      value: json['value']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.wire,
        'enabled': enabled,
        if (label != null) 'label': label,
        if (value != null) 'value': value,
      };
}

enum SupportChannelType {
  whatsapp,
  phone,
  email,
  telegram,
  messenger,
  liveChat,
  unknown;

  String get wire => switch (this) {
        SupportChannelType.whatsapp => 'whatsapp',
        SupportChannelType.phone => 'phone',
        SupportChannelType.email => 'email',
        SupportChannelType.telegram => 'telegram',
        SupportChannelType.messenger => 'messenger',
        SupportChannelType.liveChat => 'live_chat',
        SupportChannelType.unknown => 'unknown',
      };

  static SupportChannelType parse(String? raw) {
    switch ((raw ?? '').toLowerCase().trim()) {
      case 'whatsapp':
        return SupportChannelType.whatsapp;
      case 'phone':
        return SupportChannelType.phone;
      case 'email':
        return SupportChannelType.email;
      case 'telegram':
        return SupportChannelType.telegram;
      case 'messenger':
        return SupportChannelType.messenger;
      case 'live_chat':
      case 'livechat':
        return SupportChannelType.liveChat;
      default:
        return SupportChannelType.unknown;
    }
  }
}

/// Digits only.
String supportDigitsOnly(String? raw) =>
    (raw ?? '').replaceAll(RegExp(r'\D'), '');

/// Normalize IL local `05…` → `9725…` for WhatsApp deep links.
String digitsForWhatsApp(String? raw) {
  var d = supportDigitsOnly(raw);
  if (d.isEmpty) return '';
  if (d.startsWith('0') && d.length >= 9) {
    d = '972${d.substring(1)}';
  }
  return d;
}

/// Dialer path — keep local leading 0 when present so `tel:` opens correctly.
String digitsForDial(String? raw) => supportDigitsOnly(raw);

/// Display-friendly phone (keeps original spacing if already formatted).
String displaySupportPhone(String? raw) {
  final formatted = formatLocalSupportPhone(raw);
  if (formatted.isNotEmpty) return formatted;
  return (raw ?? '').trim();
}

/// Readable IL local format: `054-828-9765`.
String formatLocalSupportPhone(String? raw) {
  final d = digitsForDial(raw);
  if (d.length == 10 && d.startsWith('0')) {
    return '${d.substring(0, 3)}-${d.substring(3, 6)}-${d.substring(6)}';
  }
  if (d.length == 9 && d.startsWith('5')) {
    return '0${d.substring(0, 2)}-${d.substring(2, 5)}-${d.substring(5)}';
  }
  return d;
}

/// Short human-readable order id for support UI / messages.
String shortSupportOrderNumber(String? raw) {
  final id = (raw ?? '').trim();
  if (id.isEmpty) return '';
  if (id.length > 10) return id.substring(0, 8);
  return id;
}
