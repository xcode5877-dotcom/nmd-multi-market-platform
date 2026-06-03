import type { HomePageBlock } from '../../types/homePageBlock';
import { displayBlockLabel } from '../../types/homePageBlock';
import FeedCampaignPreview from '../feed/FeedCampaignPreview';
import type { FeedCampaign } from '../../types/feedCampaign';

type Props = {
  blocks: HomePageBlock[];
  campaignById: Record<string, FeedCampaign>;
};

function blockDescription(b: HomePageBlock): string {
  const cfg = b.config ?? {};
  switch (b.type) {
    case 'HERO_BANNERS':
      return 'سلايدر الصور العلوي';
    case 'PILLARS':
      return 'شرائح الأقسام الرئيسية';
    case 'STORE_SECTION':
      return `${cfg.source ?? 'LAYOUT_SECTION'} · ${cfg.layout ?? 'HORIZONTAL'}`;
    case 'EDITORIAL_PROMO':
      return String(cfg.campaignId ?? '—');
    case 'CUSTOM_IMAGE_BANNER':
      return cfg.imageUrl ? 'صورة مرفوعة' : 'بدون صورة';
    default:
      return '';
  }
}

/** Approximate mobile stack — order only, not pixel-perfect Flutter. */
export default function HomePageBlockPreview({ blocks, campaignById }: Props) {
  const visible = blocks.filter((b) => b.visible);
  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        لا توجد بلوكات ظاهرة للمعاينة
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[340px] rounded-[28px] border-4 border-gray-800 bg-gray-100 p-2 shadow-xl">
      <div className="rounded-[22px] bg-white overflow-hidden max-h-[520px] overflow-y-auto">
        {visible.map((b, i) => {
          const camp = campaignById[String(b.config?.campaignId ?? '')];
          const label = displayBlockLabel(b, camp?.title);
          return (
          <div key={b.id} className="border-b border-gray-100 last:border-0">
            {b.type === 'HERO_BANNERS' && (
              <div className="h-28 bg-gradient-to-l from-teal-600 to-teal-800 flex items-end p-3">
                <span className="text-white text-xs font-bold">بانرات</span>
              </div>
            )}
            {b.type === 'PILLARS' && (
              <div className="px-3 py-3 flex gap-2 overflow-x-auto">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="shrink-0 w-12 h-12 rounded-full bg-teal-100" />
                ))}
              </div>
            )}
            {b.type === 'STORE_SECTION' && (
              <div className="px-3 py-3">
                <p className="text-xs font-bold text-gray-800 mb-2">{b.title}</p>
                <div
                  className={
                    cfgLayout(b) === 'GRID'
                      ? 'grid grid-cols-2 gap-2'
                      : 'flex gap-2 overflow-x-auto'
                  }
                >
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={
                        cfgLayout(b) === 'GRID'
                          ? 'h-16 rounded-xl bg-gray-100'
                          : 'shrink-0 w-20 h-16 rounded-xl bg-gray-100'
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            {b.type === 'EDITORIAL_PROMO' && (
              <div className="px-3 py-2">
                {(() => {
                  const cid = String(b.config?.campaignId ?? '');
                  const camp = campaignById[cid];
                  if (camp) return <FeedCampaignPreview campaign={camp} />;
                  return (
                    <div className="rounded-xl bg-teal-50 p-3 text-xs text-teal-900">
                      إعلان: {cid || '—'}
                    </div>
                  );
                })()}
              </div>
            )}
            {b.type === 'CUSTOM_IMAGE_BANNER' && (
              <div className="px-3 py-2">
                <div
                  className="h-20 rounded-xl bg-cover bg-center bg-gray-200"
                  style={
                    b.config?.imageUrl
                      ? { backgroundImage: `url(${String(b.config.imageUrl)})` }
                      : undefined
                  }
                />
                <p className="text-xs font-bold mt-1">{String(b.config?.title ?? b.title)}</p>
              </div>
            )}
            <p className="px-3 pb-2 text-[10px] text-gray-400">
              {i + 1}. {label} — {blockDescription(b)}
            </p>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function cfgLayout(b: HomePageBlock): string {
  return String(b.config?.layout ?? 'HORIZONTAL');
}
