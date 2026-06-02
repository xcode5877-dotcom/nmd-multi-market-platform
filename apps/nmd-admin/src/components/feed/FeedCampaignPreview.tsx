import type { FeedCampaign } from '../../types/feedCampaign';
import {
  FEED_CAMPAIGN_KIND_LABELS,
  isMoodType,
  placementPreviewLabel,
} from '../../types/feedCampaign';

type Props = {
  campaign: Pick<
    FeedCampaign,
    'type' | 'title' | 'subtitle' | 'imageUrl' | 'iconEmoji' | 'chips' | 'ctaLabel' | 'placement'
  >;
};

/** Approximate mobile card preview for Super Admin (not pixel-perfect Flutter). */
export default function FeedCampaignPreview({ campaign }: Props) {
  const kind = campaign.type;
  const isMood = isMoodType(kind);

  if (isMood) {
    return (
      <div className="rounded-2xl bg-gradient-to-l from-teal-700 to-teal-900 p-4 text-white shadow-inner max-w-[320px] mx-auto">
        <p className="text-sm font-bold mb-3">{campaign.title || 'شو جاي عبالك اليوم؟'}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(campaign.chips ?? []).filter((c) => c.active !== false).slice(0, 6).map((chip, i) => (
            <div
              key={i}
              className="shrink-0 flex flex-col items-center gap-1 rounded-xl bg-white/15 px-3 py-2 min-w-[64px]"
            >
              {chip.iconUrl ? (
                <img src={chip.iconUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <span className="text-xl">{chip.emoji || '✨'}</span>
              )}
              <span className="text-[10px] font-semibold truncate max-w-[72px]">
                {chip.label || '—'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/70 mt-2">{placementPreviewLabel(campaign.placement)}</p>
      </div>
    );
  }

  if (kind === 'COMPETITION_CARD' || kind === 'CHALLENGE_CARD') {
    return (
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 max-w-[320px] mx-auto">
        <p className="text-xs text-amber-800 font-semibold">🏆 {FEED_CAMPAIGN_KIND_LABELS[kind]}</p>
        <p className="font-bold text-gray-900 mt-1">{campaign.title || 'تحدي'}</p>
        <p className="text-sm text-gray-600 mt-1">{campaign.subtitle}</p>
        {campaign.ctaLabel && (
          <span className="inline-block mt-3 rounded-full bg-amber-500 px-4 py-1 text-xs text-white font-bold">
            {campaign.ctaLabel}
          </span>
        )}
      </div>
    );
  }

  if (kind === 'REWARD_CARD' || kind === 'REWARDS_DISCOVERY') {
    return (
      <div className="rounded-2xl bg-violet-100 border border-violet-200 p-4 max-w-[320px] mx-auto">
        <p className="text-xs text-violet-800 font-semibold">🎁 مكافآت</p>
        <p className="font-bold text-gray-900 mt-1">{campaign.title || 'اكتشف المكافآت'}</p>
        <p className="text-sm text-gray-600">{campaign.subtitle}</p>
      </div>
    );
  }

  if (kind === 'STORE_FEATURE' || kind === 'FEATURED_STORE_STORY') {
    return (
      <div className="rounded-2xl overflow-hidden border border-gray-200 max-w-[320px] mx-auto bg-white">
        {campaign.imageUrl ? (
          <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${campaign.imageUrl})` }} />
        ) : (
          <div className="h-20 bg-teal-100 flex items-center justify-center text-3xl">
            {campaign.iconEmoji || '🏪'}
          </div>
        )}
        <div className="p-3">
          <p className="font-bold text-gray-900 text-sm">{campaign.title || 'متجر مميز'}</p>
          <p className="text-xs text-gray-500 line-clamp-2">{campaign.subtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 max-w-[320px] mx-auto bg-white shadow-sm">
      {campaign.imageUrl ? (
        <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url(${campaign.imageUrl})` }} />
      ) : (
        <div className="h-20 bg-gradient-to-l from-teal-600 to-teal-800 flex items-center justify-center text-2xl text-white">
          {campaign.iconEmoji || '✨'}
        </div>
      )}
      <div className="p-3">
        <p className="text-[10px] text-teal-700 font-semibold">{FEED_CAMPAIGN_KIND_LABELS[kind]}</p>
        <p className="font-bold text-gray-900">{campaign.title || 'بانر'}</p>
        <p className="text-xs text-gray-500">{campaign.subtitle}</p>
      </div>
    </div>
  );
}
