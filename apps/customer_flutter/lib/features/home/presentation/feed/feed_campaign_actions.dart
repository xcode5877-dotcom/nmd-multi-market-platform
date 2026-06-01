import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../domain/feed/feed_campaign.dart';
import 'feed_campaign_popup_sheet.dart';

void handleFeedCampaignAction(
  BuildContext context, {
  required FeedCampaign campaign,
  required String marketSlug,
  Map<String, String> storeIdBySlug = const {},
}) {
  switch (campaign.actionType) {
    case FeedCampaignActionType.none:
      return;
    case FeedCampaignActionType.openStore:
      final raw = campaign.targetId?.trim() ?? '';
      if (raw.isEmpty) return;
      final storeId = storeIdBySlug[raw] ?? raw;
      context.push('/market/$marketSlug/store/$storeId');
      return;
    case FeedCampaignActionType.openReward:
      context.push('/market/$marketSlug/rewards');
      return;
    case FeedCampaignActionType.openCompetition:
      context.push('/market/$marketSlug/rewards');
      return;
    case FeedCampaignActionType.openCategory:
      final pillar = campaign.targetId?.trim() ?? '';
      if (pillar.isEmpty) return;
      context.push('/market/$marketSlug?pillar=$pillar');
      return;
    case FeedCampaignActionType.openPopup:
      showFeedCampaignPopup(context, campaign: campaign, marketSlug: marketSlug);
      return;
    case FeedCampaignActionType.externalLink:
      final url = campaign.targetUrl?.trim() ?? '';
      if (url.isEmpty) {
        final route = campaign.targetId?.trim() ?? '';
        if (route.isEmpty) return;
        if (route.startsWith('/market/')) {
          context.push(route);
        } else if (route.startsWith('/')) {
          context.push('/market/$marketSlug$route');
        } else {
          context.push('/market/$marketSlug/$route');
        }
        return;
      }
      final uri = Uri.tryParse(url);
      if (uri == null) return;
      launchUrl(uri, mode: LaunchMode.externalApplication);
      return;
  }
}
