import '../../../api/storefront_api.dart';
import '../domain/feed/feed_campaign.dart';

/// Loads active home-feed campaigns from market API (no bundled promos when API empty).
class FeedCampaignRepository {
  FeedCampaignRepository(this._api);

  final StorefrontApi _api;

  Future<List<FeedCampaign>> activeCampaignsForMarket(String marketSlug) async {
    try {
      final rows = await _api.getMarketFeedCampaigns(marketSlug);
      return rows
          .map(FeedCampaign.fromJson)
          .where((c) => c.active && c.isWithinSchedule)
          .toList();
    } catch (_) {
      return const [];
    }
  }
}
