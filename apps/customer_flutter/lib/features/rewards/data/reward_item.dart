import 'package:equatable/equatable.dart';

enum RewardFilter { all, tournaments, coupons, prizes }

final class RewardItem extends Equatable {
  const RewardItem({
    required this.id,
    required this.titleAr,
    required this.titleEn,
    required this.type,
    required this.coinsCost,
    required this.locked,
    this.lockReason,
    this.description,
    this.imageUrl,
  });

  final String id;
  final String titleAr;
  final String titleEn;
  final String type;
  final int coinsCost;
  final bool locked;
  final String? lockReason;
  final String? description;

  /// Admin-provided reward art (`image_url` from API).
  final String? imageUrl;

  factory RewardItem.fromJson(Map<String, dynamic> json) {
    return RewardItem(
      id: json['id'] as String,
      titleAr: json['title_ar'] as String? ?? '',
      titleEn: json['title_en'] as String? ?? '',
      type: (json['type'] as String? ?? 'COUPON').toUpperCase(),
      coinsCost: (json['coins_cost'] as num?)?.toInt() ?? 0,
      locked: json['locked'] as bool? ?? false,
      lockReason: json['lock_reason'] as String?,
      description: json['description'] as String?,
      imageUrl: json['image_url'] as String?,
    );
  }

  bool matchesFilter(RewardFilter filter) {
    switch (filter) {
      case RewardFilter.all:
        return true;
      case RewardFilter.tournaments:
        return type == 'TOURNAMENT' || type == 'EVENT';
      case RewardFilter.coupons:
        return type == 'COUPON';
      case RewardFilter.prizes:
        return type == 'PRIZE';
    }
  }

  @override
  List<Object?> get props => [
        id,
        titleAr,
        titleEn,
        type,
        coinsCost,
        locked,
        lockReason,
        description,
        imageUrl
      ];
}

/// Tier derived from coin balance until the API exposes a dedicated field.
String loyaltyTierLabel(int balance) {
  if (balance < 100) return 'فضي';
  if (balance < 500) return 'ذهبي';
  return 'VIP';
}

/// Progress toward the next tier (Silver → Gold → VIP) for the rewards hero bar.
final class LoyaltyTierProgress {
  const LoyaltyTierProgress({
    required this.fraction,
    required this.currentTierAr,
    required this.nextTierAr,
    required this.coinsToNext,
    required this.nextThreshold,
    required this.isMaxTier,
  });

  final double fraction;
  final String currentTierAr;
  final String nextTierAr;
  final int coinsToNext;
  final int nextThreshold;
  final bool isMaxTier;
}

LoyaltyTierProgress loyaltyTierProgressForBalance(int balance) {
  if (balance < 100) {
    return LoyaltyTierProgress(
      fraction: (balance / 100).clamp(0.0, 1.0),
      currentTierAr: 'فضي',
      nextTierAr: 'ذهبي',
      coinsToNext: (100 - balance).clamp(0, 100),
      nextThreshold: 100,
      isMaxTier: false,
    );
  }
  if (balance < 500) {
    return LoyaltyTierProgress(
      fraction: ((balance - 100) / 400).clamp(0.0, 1.0),
      currentTierAr: 'ذهبي',
      nextTierAr: 'VIP',
      coinsToNext: (500 - balance).clamp(0, 400),
      nextThreshold: 500,
      isMaxTier: false,
    );
  }
  return LoyaltyTierProgress(
    fraction: 1.0,
    currentTierAr: 'VIP',
    nextTierAr: 'VIP',
    coinsToNext: 0,
    nextThreshold: 500,
    isMaxTier: true,
  );
}

/// Bold category line (teal accents in UI).
String rewardCategoryHeaderAr(String type) {
  switch (type.toUpperCase()) {
    case 'TOURNAMENT':
    case 'EVENT':
      return 'البطولات';
    case 'COUPON':
      return 'القسائم';
    case 'PRIZE':
      return 'الجوائز';
    default:
      return 'مكافأة';
  }
}

String valueLabelFor(RewardItem r) {
  final t = '${r.titleAr} ${r.titleEn}';
  final ils = RegExp(r'(\d+)\s*₪').firstMatch(t);
  if (ils != null) return '${ils.group(1)}₪ OFF';
  final pct = RegExp(r'(\d+)\s*%').firstMatch(t);
  if (pct != null) return '${pct.group(1)}% OFF';
  if (r.description != null && r.description!.isNotEmpty) {
    final short = r.description!.trim();
    if (short.length <= 24) return short;
    return '${short.substring(0, 22)}…';
  }
  return 'مكافأة';
}
