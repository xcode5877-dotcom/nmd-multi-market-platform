import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../design_system/design_system.dart';

/// Premium store tile for home horizontal lists.
class HomeStoreCard extends StatelessWidget {
  const HomeStoreCard({
    super.key,
    required this.marketSlug,
    required this.storeId,
    required this.storeName,
    required this.categoryLabel,
    required this.logoUrl,
    required this.openStatus,
  });

  final String marketSlug;
  final String storeId;
  final String storeName;
  final String categoryLabel;
  final String logoUrl;
  final String openStatus;

  static const double cardWidth = 152;
  static const double logoAreaHeight = 112;

  @override
  Widget build(BuildContext context) {
    final status = NmdSemantic.storeStatusFromApi(openStatus);
    final statusLabel = _statusLabelLong(openStatus);
    final statusColor = NmdSemantic.storeStatusForeground(status);

    return SizedBox(
      width: cardWidth,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.push('/market/$marketSlug/store/$storeId'),
          borderRadius: NmdRadius.borderMd,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: NmdColors.surfaceBase,
              borderRadius: NmdRadius.borderMd,
              border: const Border.fromBorderSide(
                BorderSide(color: NmdColors.borderSubtle),
              ),
              boxShadow: NmdShadows.sm,
            ),
            child: Column(
              children: [
                SizedBox(
                  height: logoAreaHeight,
                  width: double.infinity,
                  child: Stack(
                    children: [
                      ClipRRect(
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(NmdRadius.md),
                        ),
                        child: ColoredBox(
                          color: NmdColors.tintAliveMuted,
                          child: Center(
                            child: Hero(
                              tag: 'store-logo-$storeId',
                              child: Container(
                                width: 80,
                                height: 80,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border:
                                      Border.all(color: NmdColors.borderSubtle),
                                  color: NmdColors.surfaceBase,
                                ),
                                child: ClipOval(
                                  child: logoUrl.isNotEmpty
                                      ? CachedNetworkImage(
                                          imageUrl: logoUrl,
                                          fit: BoxFit.cover,
                                          memCacheWidth: 180,
                                          memCacheHeight: 180,
                                          fadeInDuration: NmdMotion.fast,
                                          errorWidget: (_, __, ___) =>
                                              _logoPlaceholder(),
                                        )
                                      : _logoPlaceholder(),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        right: NmdSpacing.xxs,
                        top: NmdSpacing.xxs,
                        child: _StoreStatusPill(
                          label: statusLabel,
                          color: statusColor,
                          pulsing: status == NmdStoreStatus.open,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    NmdSpacing.xs,
                    NmdSpacing.sm,
                    NmdSpacing.xs,
                    NmdSpacing.xxs,
                  ),
                  child: Text(
                    storeName,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: NmdTypography.bodyBold,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    NmdSpacing.xs,
                    0,
                    NmdSpacing.xs,
                    NmdSpacing.sm,
                  ),
                  child: Text(
                    categoryLabel,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: NmdTypography.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static Widget _logoPlaceholder() {
    return ColoredBox(
      color: NmdColors.tintAliveSoft,
      child: Icon(Icons.storefront_rounded,
          color: NmdColors.brandPrimary.withValues(alpha: 0.5)),
    );
  }

  static String _statusLabelLong(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'open':
        return 'مفتوح الآن';
      case 'busy':
        return 'مزدحم';
      default:
        return 'مغلق';
    }
  }
}

class _StoreStatusPill extends StatefulWidget {
  const _StoreStatusPill({
    required this.label,
    required this.color,
    required this.pulsing,
  });

  final String label;
  final Color color;
  final bool pulsing;

  @override
  State<_StoreStatusPill> createState() => _StoreStatusPillState();
}

class _StoreStatusPillState extends State<_StoreStatusPill>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void initState() {
    super.initState();
    if (widget.pulsing) _pulse.repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dot = Container(
      width: 7,
      height: 7,
      decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: NmdRadius.borderPill,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          widget.pulsing
              ? AnimatedBuilder(
                  animation: _pulse,
                  builder: (_, __) => Transform.scale(
                    scale: 0.9 + (_pulse.value * 0.2),
                    child: dot,
                  ),
                )
              : dot,
          const SizedBox(width: 5),
          Text(
            widget.label,
            style: NmdTypography.micro.copyWith(
              color: NmdColors.textOnBrand,
              fontSize: 9,
            ),
          ),
        ],
      ),
    );
  }
}

/// Shared category label mapping for home store rows.
String homeStoreCategoryLabel(String raw) {
  final code = raw.toUpperCase();
  if (code == 'FOOD') return 'مطاعم';
  if (code == 'CLOTHING') return 'ملابس';
  if (code == 'GROCERIES') return 'خضار';
  if (code == 'BUTCHER') return 'ملحمة';
  if (code == 'OFFERS') return 'عروض';
  if (raw.isEmpty) return 'عام';
  return raw;
}
