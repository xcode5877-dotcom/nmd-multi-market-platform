import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../../../core/debug/nmd_feed_trace.dart';
import '../../../domain/feed/feed_campaign.dart';
import 'feed_campaign_motion.dart';

/// Shared padding for feed promo blocks.
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
      nmdFeedTrace(
        '[FEED_RENDER] blockType=$blockType id=${campaign?.id ?? '-'}',
        verbose: true,
      );
    }

    return RepaintBoundary(
      child: FeedCampaignFadeIn(
        index: listIndex,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 16, 14),
          child: onTap == null
              ? child
              : FeedCampaignPressable(onTap: onTap!, child: child),
        ),
      ),
    );
  }
}
