import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_motion.dart';

/// Shared padding + optional debug label for feed promo blocks.
class FeedPromoChrome extends StatelessWidget {
  const FeedPromoChrome({
    super.key,
    required this.child,
    required this.blockType,
    this.campaign,
    this.listIndex = 0,
    this.onTap,
  });

  final Widget child;
  final String blockType;
  final FeedCampaign? campaign;
  final int listIndex;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (kDebugMode) {
      debugPrint('[FEED_RENDER] blockType=$blockType id=${campaign?.id ?? '-'}');
    }

    final body = FeedCampaignFadeIn(
      index: listIndex,
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 16, 14),
        child: onTap == null
            ? child
            : FeedCampaignPressable(onTap: onTap!, child: child),
      ),
    );

    if (!kDebugMode) return RepaintBoundary(child: body);

    return RepaintBoundary(
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          body,
          PositionedDirectional(
            top: 2,
            start: 8,
            child: IgnorePointer(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.72),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Promo Block · $blockType',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
