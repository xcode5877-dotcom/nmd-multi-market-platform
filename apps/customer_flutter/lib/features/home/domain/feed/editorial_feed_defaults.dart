import 'feed_campaign.dart';
import 'feed_campaign_chip.dart';

/// Built-in editorial slots for debug/dev when API returns no campaigns.
abstract final class EditorialFeedDefaults {
  static FeedCampaign moodFor(String marketSlug) => FeedCampaign(
        id: '__editorial_mood__',
        marketSlug: marketSlug,
        kind: FeedCampaignKind.categoryDiscovery,
        title: 'شو جاي عبالك اليوم؟',
        subtitle: '',
        ctaLabel: 'اكتشف',
        actionType: FeedCampaignActionType.openCategory,
        placement: FeedCampaignPlacement.afterSection1,
        chips: const [
          FeedCampaignChip(label: 'بيتزا', emoji: '🍕'),
          FeedCampaignChip(label: 'برجر', emoji: '🍔'),
          FeedCampaignChip(label: 'شاورما', emoji: '🌯'),
        ],
      );

  static FeedCampaign glassFor(String marketSlug) => FeedCampaign(
        id: '__editorial_glass__',
        marketSlug: marketSlug,
        kind: FeedCampaignKind.offerStrip,
        title: '🔥 عروض الليل',
        subtitle: 'خصومات من محلاتك المفضلة',
        ctaLabel: 'اكتشف',
        actionType: FeedCampaignActionType.none,
        placement: FeedCampaignPlacement.afterSection2,
      );
}
