import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../api/resolve_image_url.dart';
import '../../../../design_system/design_system.dart';

/// Two-column restaurant tile for pillar/category filtered home.
class RestaurantGridStoreCard extends StatelessWidget {
  const RestaurantGridStoreCard({
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

  @override
  Widget build(BuildContext context) {
    final status = NmdSemantic.storeStatusFromApi(openStatus);
    final statusLabel = _statusLabel(openStatus);
    final statusColor = NmdSemantic.storeStatusForeground(status);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push('/market/$marketSlug/store/$storeId'),
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          decoration: BoxDecoration(
            color: NmdColors.surfaceBase,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: NmdColors.brandPrimary.withValues(alpha: 0.1),
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0E7C72).withValues(alpha: 0.08),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AspectRatio(
                aspectRatio: 1.05,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(22),
                      ),
                      child: ColoredBox(
                        color: NmdColors.tintAliveMuted,
                        child: logoUrl.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: resolveImageUrl(logoUrl),
                                fit: BoxFit.cover,
                                memCacheWidth: 320,
                              )
                            : Icon(
                                Icons.restaurant_rounded,
                                size: 40,
                                color: NmdColors.brandPrimary
                                    .withValues(alpha: 0.45),
                              ),
                      ),
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.94),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          statusLabel,
                          style: NmdTypography.micro.copyWith(
                            color: statusColor,
                            fontWeight: FontWeight.w800,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 10, 10, 12),
                child: Directionality(
                  textDirection: TextDirection.rtl,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        storeName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: NmdTypography.bodyBold.copyWith(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        categoryLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: NmdTypography.bodySmall.copyWith(
                          color: NmdColors.textSecondary,
                          fontSize: 11.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _statusLabel(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'open':
        return 'مفتوح';
      case 'busy':
        return 'مزدحم';
      default:
        return 'مغلق';
    }
  }
}
