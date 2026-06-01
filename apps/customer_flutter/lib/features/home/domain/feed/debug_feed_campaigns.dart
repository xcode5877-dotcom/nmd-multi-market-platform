import 'package:flutter/foundation.dart';

import 'feed_campaign.dart';

/// Debug-only editorial samples when the API returns none (never in release).
List<FeedCampaign> debugFeedCampaignFallback(String marketSlug) {
  if (!kDebugMode) return const [];

  return [
    FeedCampaign(
      id: 'debug_fc_food_mood',
      marketSlug: marketSlug,
      kind: FeedCampaignKind.categoryDiscovery,
      title: 'شو جاي عبالك اليوم؟',
      subtitle: 'اختر مزاجك واكتشف محلات قريبة',
      ctaLabel: 'اكتشف',
      actionType: FeedCampaignActionType.openCategory,
      active: true,
      placement: FeedCampaignPlacement.afterSection1,
      priority: 200,
      sortOrder: 0,
      categoryLabels: const ['بيتزا', 'برغر', 'آسيوي', 'قهوة'],
    ),
    FeedCampaign(
      id: 'debug_fc_challenge',
      marketSlug: marketSlug,
      kind: FeedCampaignKind.competitionCard,
      title: 'تحدي الأسبوع',
      subtitle: 'اربح 500₪',
      ctaLabel: 'شارك الآن',
      actionType: FeedCampaignActionType.openCompetition,
      active: true,
      placement: FeedCampaignPlacement.afterEvery2Rows,
      priority: 150,
      sortOrder: 1,
      participantCount: 18,
    ),
    FeedCampaign(
      id: 'debug_fc_rewards',
      marketSlug: marketSlug,
      kind: FeedCampaignKind.rewardCard,
      title: 'معك عملات؟ 👀',
      subtitle: 'استبدلها بمكافآت من محلاتك المفضلة',
      ctaLabel: 'المكافآت',
      actionType: FeedCampaignActionType.openReward,
      active: true,
      placement: FeedCampaignPlacement.afterSection2,
      priority: 140,
      sortOrder: 2,
    ),
  ];
}

bool isDebugFeedCampaign(FeedCampaign campaign) =>
    kDebugMode && campaign.id.startsWith('debug_fc_');
