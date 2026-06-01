import 'package:flutter/foundation.dart';

import 'feed_campaign.dart';

/// Debug-only sample promos when the API returns none (never in release).
List<FeedCampaign> debugFeedCampaignFallback(String marketSlug) {
  if (!kDebugMode) return const [];

  return [
    FeedCampaign(
      id: 'debug_fc_hero',
      marketSlug: marketSlug,
      kind: FeedCampaignKind.heroBanner,
      title: 'شو عبالك اليوم؟',
      subtitle: 'خلينا نساعدك تختار من أفضل المحلات حولك',
      ctaLabel: 'اكتشف الآن',
      actionType: FeedCampaignActionType.openPopup,
      popupBody: 'اكتشف محلات السوق القريبة منك.',
      active: true,
      placement: FeedCampaignPlacement.top,
      priority: 200,
      sortOrder: 0,
      backgroundStyle: FeedCampaignBackgroundStyle.tealGradient,
    ),
    FeedCampaign(
      id: 'debug_fc_competition',
      marketSlug: marketSlug,
      kind: FeedCampaignKind.competitionCard,
      title: 'بطولة الشطرنج',
      subtitle: 'شارك واربح جوائز مميزة',
      ctaLabel: 'اشترك الآن',
      actionType: FeedCampaignActionType.openCompetition,
      active: true,
      placement: FeedCampaignPlacement.afterSection1,
      priority: 150,
      sortOrder: 1,
      participantCount: 12,
      backgroundStyle: FeedCampaignBackgroundStyle.navySoft,
    ),
  ];
}

bool isDebugFeedCampaign(FeedCampaign campaign) =>
    kDebugMode && campaign.id.startsWith('debug_fc_');
