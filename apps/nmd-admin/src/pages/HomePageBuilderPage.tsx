import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Modal, Select, useToast } from '@nmd/ui';
import {
  Copy,
  GripVertical,
  Image,
  LayoutGrid,
  Megaphone,
  Plus,
  Rows3,
  Save,
  Store,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  apiFetch,
  apiUploadSingleImage,
  listMarketFeedCampaigns,
  listMarketHomePageBlocks,
  saveMarketFeedCampaigns,
  saveMarketHomePageBlocks,
} from '../api';
import HomePageBlockPreview from '../components/homeBuilder/HomePageBlockPreview';
import HomePageStorePicker from '../components/homeBuilder/HomePageStorePicker';
import MoodChipsEditor from '../components/feed/MoodChipsEditor';
import {
  asArray,
  normalizeMarketsList,
  normalizePillarsList,
  normalizeTenantsList,
} from '../lib/feedCampaignNormalize';
import {
  FEED_CAMPAIGN_KIND_LABELS,
  isMoodType,
  type FeedCampaign,
  type FeedCampaignChip,
} from '../types/feedCampaign';
import {
  HOME_PAGE_BLOCK_TYPE_LABELS,
  displayBlockLabel,
  STORE_SECTION_SOURCE_LABELS,
  createHomePageBlock,
  homePageBlocksSnapshotKey,
  normalizeHomePageBlocksList,
  validateHomePageBlocksClient,
  type HomePageBlock,
  type HomePageBlockType,
  type StoreSectionLayout,
  type StoreSectionSource,
} from '../types/homePageBlock';

const BLOCK_ICONS: Record<HomePageBlockType, typeof Image> = {
  HERO_BANNERS: Image,
  PILLARS: LayoutGrid,
  STORE_SECTION: Store,
  EDITORIAL_PROMO: Megaphone,
  CUSTOM_IMAGE_BANNER: Rows3,
};

const ADD_BLOCK_TYPES: HomePageBlockType[] = [
  'HERO_BANNERS',
  'PILLARS',
  'STORE_SECTION',
  'EDITORIAL_PROMO',
  'CUSTOM_IMAGE_BANNER',
];

const EDITORIAL_PRESETS: Array<{ campaignId: string; label: string }> = [
  { campaignId: 'fc_food_mood', label: 'مزاج الطعام — شو جاي عبالك؟' },
  { campaignId: 'fc_weekly_challenge', label: 'تحدي / مسابقة' },
  { campaignId: 'fc_rewards_nudge', label: 'تذكير بالمكافآت' },
  { campaignId: 'fc_new_store_story', label: 'محل جديد / مميز' },
];

type LayoutSection = { id: string; title: string; storeIds: string[] };

export default function HomePageBuilderPage() {
  const addToast = useToast().addToast;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [marketSlug, setMarketSlug] = useState('dabburiyya');
  const [working, setWorking] = useState<HomePageBlock[]>([]);
  const [serverKey, setServerKey] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<HomePageBlock | null>(null);
  const [uploading, setUploading] = useState(false);
  const [moodChipsDraft, setMoodChipsDraft] = useState<FeedCampaignChip[]>([]);

  const { data: markets = [] } = useQuery({
    queryKey: ['markets-list-home-builder'],
    queryFn: async () => normalizeMarketsList(await apiFetch<unknown>('/markets')),
  });

  const { data: blocks = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['home-page-blocks', marketSlug],
    queryFn: () => listMarketHomePageBlocks(marketSlug),
    enabled: !!marketSlug.trim(),
  });

  const { data: layoutSections = [] } = useQuery({
    queryKey: ['home-builder-layout', marketSlug],
    queryFn: async () => {
      const raw = await apiFetch<unknown>(`/markets/by-slug/${encodeURIComponent(marketSlug)}/layout`);
      return asArray<LayoutSection>(raw).map((s) => ({
        id: String(s.id ?? ''),
        title: String(s.title ?? ''),
        storeIds: asArray<string>(s.storeIds),
      }));
    },
    enabled: !!marketSlug.trim(),
  });

  const { data: pillars = [] } = useQuery({
    queryKey: ['pillars-home-builder'],
    queryFn: async () => normalizePillarsList(await apiFetch<unknown>('/pillars')),
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['market-tenants-home-builder', marketSlug],
    queryFn: async () => {
      const rows = await apiFetch<unknown>(`/markets/${encodeURIComponent(marketSlug)}/tenants`);
      return normalizeTenantsList(rows);
    },
    enabled: !!marketSlug.trim(),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['feed-campaigns-home-builder', marketSlug],
    queryFn: () => listMarketFeedCampaigns(marketSlug),
    enabled: !!marketSlug.trim(),
  });

  const campaignById = useMemo(() => {
    const m: Record<string, FeedCampaign> = {};
    for (const c of campaigns) m[c.id] = c;
    return m;
  }, [campaigns]);

  useEffect(() => {
    const sorted = normalizeHomePageBlocksList(blocks);
    setWorking(sorted);
    setServerKey(homePageBlocksSnapshotKey(sorted));
  }, [blocks, marketSlug]);

  const dirty = homePageBlocksSnapshotKey(working) !== serverKey;
  const validationErrors = useMemo(() => validateHomePageBlocksClient(working), [working]);

  const saveMutation = useMutation({
    mutationFn: (next: HomePageBlock[]) =>
      saveMarketHomePageBlocks(
        marketSlug,
        next.map((b, i) => ({ ...b, sortOrder: i })),
      ),
    onSuccess: async (data) => {
      const sorted = normalizeHomePageBlocksList(data);
      queryClient.setQueryData(['home-page-blocks', marketSlug], sorted);
      setWorking(sorted);
      setServerKey(homePageBlocksSnapshotKey(sorted));
      await refetch();
      addToast('تم حفظ ترتيب الصفحة الرئيسية', 'success');
    },
    onError: (e: Error) => addToast(e.message || 'فشل الحفظ', 'error'),
  });

  const persistLocal = (next: HomePageBlock[]) => {
    setWorking(next.map((b, i) => ({ ...b, sortOrder: i })));
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = working.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const next = [...working];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persistLocal(next);
  };

  const toggleVisible = (id: string) => {
    persistLocal(working.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)));
  };

  const duplicateBlock = (block: HomePageBlock) => {
    const copy = createHomePageBlock(block.type, {
      ...block,
      id: `block_${Date.now()}`,
      title: `${block.title} (نسخة)`,
      config: { ...block.config },
    });
    persistLocal([...working, copy]);
    addToast('تم تكرار البلوك — احفظ لتفعيله', 'info');
  };

  const removeBlock = (id: string) => {
    if (!window.confirm('إزالة هذا البلوك من القائمة؟')) return;
    persistLocal(working.filter((b) => b.id !== id));
  };

  const openEdit = (block: HomePageBlock) => {
    setEditId(block.id);
    setDraft({ ...block, config: { ...block.config } });
    const cid = String(block.config?.campaignId ?? '');
    const camp = campaignById[cid];
    setMoodChipsDraft(camp?.chips ? [...camp.chips] : []);
  };

  const openAdd = (type: HomePageBlockType) => {
    setAddOpen(false);
    const block = createHomePageBlock(type, { sortOrder: working.length });
    if (type === 'STORE_SECTION' && layoutSections[0]) {
      block.config = {
        ...block.config,
        source: 'LAYOUT_SECTION',
        layoutSectionId: layoutSections[0].id,
        storeIds: layoutSections[0].storeIds,
      };
      block.title = layoutSections[0].title;
    }
    if (type === 'EDITORIAL_PROMO' && campaigns[0]) {
      block.config = { campaignId: campaigns[0].id };
      block.title = campaigns[0].title;
    }
    setEditId(null);
    setDraft(block);
  };

  const saveDraft = async () => {
    if (!draft) return;
    const errs = validateHomePageBlocksClient([draft]);
    if (errs.length > 0) {
      addToast(errs[0], 'error');
      return;
    }
    if (draft.type === 'EDITORIAL_PROMO') {
      const cid = String(draft.config.campaignId ?? '');
      const camp = campaignById[cid];
      if (camp && isMoodType(camp.type) && moodChipsDraft.length > 0) {
        try {
          const nextCampaigns = campaigns.map((c) =>
            c.id === cid ? { ...c, chips: moodChipsDraft } : c,
          );
          await saveMarketFeedCampaigns(marketSlug, nextCampaigns);
          queryClient.setQueryData(['feed-campaigns-home-builder', marketSlug], nextCampaigns);
        } catch (e) {
          addToast(e instanceof Error ? e.message : 'فشل حفظ أيقونات المزاج', 'error');
          return;
        }
      }
    }
    if (editId) {
      persistLocal(working.map((b) => (b.id === editId ? draft : b)));
    } else {
      persistLocal([...working, draft]);
    }
    setDraft(null);
    setEditId(null);
    setMoodChipsDraft([]);
  };

  const handleSave = () => {
    if (validationErrors.length > 0) {
      addToast(validationErrors[0], 'error');
      return;
    }
    saveMutation.mutate(working);
  };

  const handleBannerUpload = async (file: File) => {
    if (!draft) return;
    setUploading(true);
    try {
      const url = await apiUploadSingleImage(file);
      setDraft({
        ...draft,
        config: { ...draft.config, imageUrl: url },
      });
      addToast('تم رفع الصورة', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل الرفع', 'error');
    } finally {
      setUploading(false);
    }
  };

  const campaignOptions = [
    ...EDITORIAL_PRESETS.filter((p) => campaignById[p.campaignId]),
    ...campaigns.map((c) => ({
      campaignId: c.id,
      label: `${c.title} (${FEED_CAMPAIGN_KIND_LABELS[c.type] ?? c.type})`,
    })),
  ];

  const uniqueCampaignOptions = campaignOptions.filter(
    (opt, i, arr) => arr.findIndex((x) => x.campaignId === opt.campaignId) === i,
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ترتيب الصفحة الرئيسية</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            قائمة بسيطة بالترتيب والظهور — بدون placements أو أولويات مخفية. الحفظ يفعّل البناء
            المرئي لتطبيق الزبون.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading || isFetching}>
            تحديث
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending || validationErrors.length > 0}
          >
            <Save className="w-4 h-4 ms-1" />
            {saveMutation.isPending ? 'جاري الحفظ…' : 'حفظ الترتيب'}
          </Button>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-4 items-end">
        <div className="min-w-[200px]">
          <Select
            label="السوق"
            value={marketSlug}
            onChange={(e) => setMarketSlug(e.target.value)}
            options={markets.map((m) => ({ value: m.slug, label: m.name || m.slug }))}
          />
        </div>
        {dirty && (
          <p className="text-sm text-amber-700 font-medium">تغييرات غير محفوظة</p>
        )}
        {validationErrors.length > 0 && (
          <p className="text-sm text-red-600">{validationErrors.join(' · ')}</p>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">ترتيب الصفحة الرئيسية</h2>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 ms-1" />
              إضافة بلوك
            </Button>
          </div>

          {isLoading ? (
            <Card className="p-8 text-center text-gray-500">جاري التحميل…</Card>
          ) : working.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              لا توجد بلوكات — أضف بلوكاً أو احفظ القالب الافتراضي بعد التحميل.
            </Card>
          ) : (
            <ul className="space-y-3">
              {working.map((block, index) => {
                const Icon = BLOCK_ICONS[block.type];
                return (
                  <li key={block.id}>
                    <Card
                      className={`p-4 flex gap-3 items-start ${!block.visible ? 'opacity-60 bg-gray-50' : ''}`}
                    >
                      <div className="flex flex-col gap-1 shrink-0 pt-1">
                        <button
                          type="button"
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => moveBlock(block.id, -1)}
                          aria-label="أعلى"
                        >
                          <GripVertical className="w-5 h-5 rotate-180" />
                        </button>
                        <button
                          type="button"
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                          disabled={index === working.length - 1}
                          onClick={() => moveBlock(block.id, 1)}
                          aria-label="أسفل"
                        >
                          <GripVertical className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono">{index + 1}</span>
                          <p className="font-bold text-gray-900 truncate">
                            {displayBlockLabel(block, campaignById[String(block.config?.campaignId ?? '')]?.title)}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {HOME_PAGE_BLOCK_TYPE_LABELS[block.type]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {block.visible ? 'ظاهر للزبون' : 'مخفي'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1 shrink-0">
                        <button
                          type="button"
                          className="p-2 rounded-lg hover:bg-gray-100"
                          onClick={() => toggleVisible(block.id)}
                          title={block.visible ? 'إخفاء' : 'إظهار'}
                        >
                          {block.visible ? (
                            <ToggleRight className="w-5 h-5 text-teal-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(block)}>
                          تعديل
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => duplicateBlock(block)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => removeBlock(block.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">معاينة الجوال</h2>
          <HomePageBlockPreview blocks={working} campaignById={campaignById} />
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="إضافة بلوك">
        <div className="grid gap-3 sm:grid-cols-2">
          {ADD_BLOCK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className="rounded-xl border border-gray-200 p-4 text-right hover:border-teal-500 hover:bg-teal-50 transition"
              onClick={() => openAdd(type)}
            >
              <p className="font-bold text-gray-900">{HOME_PAGE_BLOCK_TYPE_LABELS[type]}</p>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={!!draft}
        onClose={() => {
          setDraft(null);
          setEditId(null);
        }}
        title={editId ? 'تعديل البلوك' : 'بلوك جديد'}
      >
        {draft && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <Input
              label="العنوان (للإدارة)"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />

            {draft.type === 'STORE_SECTION' && (
              <>
                <Input
                  label="عنوان القسم (يظهر للزبون)"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <Select
                  label="مصدر المحلات"
                  value={String(draft.config.source ?? 'LAYOUT_SECTION')}
                  onChange={(e) => {
                    const source = e.target.value as StoreSectionSource;
                    const nextConfig: Record<string, unknown> = {
                      ...draft.config,
                      source,
                    };
                    if (source === 'FEATURED') {
                      const sec = layoutSections.find((s) => s.id === 'featured');
                      if (sec) nextConfig.storeIds = [...sec.storeIds];
                    }
                    setDraft({ ...draft, config: nextConfig });
                  }}
                  options={Object.entries(STORE_SECTION_SOURCE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
                {String(draft.config.source) === 'LAYOUT_SECTION' && (
                  <Select
                    label="قسم التخطيط"
                    value={String(draft.config.layoutSectionId ?? '')}
                    onChange={(e) => {
                      const sec = layoutSections.find((s) => s.id === e.target.value);
                      setDraft({
                        ...draft,
                        title: sec?.title ?? draft.title,
                        config: {
                          ...draft.config,
                          layoutSectionId: e.target.value,
                          storeIds: sec?.storeIds ?? [],
                        },
                      });
                    }}
                    options={layoutSections.map((s) => ({ value: s.id, label: s.title }))}
                  />
                )}
                {String(draft.config.source) === 'PILLAR' && (
                  <Select
                    label="العمود"
                    value={String(draft.config.pillarId ?? '')}
                    onChange={(e) =>
                      setDraft({ ...draft, config: { ...draft.config, pillarId: e.target.value } })
                    }
                    options={pillars.map((p) => ({
                      value: p.id,
                      label: p.nameAr || p.title || p.name || p.id,
                    }))}
                  />
                )}
                {String(draft.config.source) === 'MANUAL' && (
                  <HomePageStorePicker
                    tenants={tenants.map((t) => ({
                      id: t.id,
                      name: t.name,
                      slug: t.slug,
                      logoUrl: (t as { logoUrl?: string }).logoUrl,
                    }))}
                    selectedIds={asArray<string>(draft.config.storeIds)}
                    onChange={(ids) =>
                      setDraft({
                        ...draft,
                        config: { ...draft.config, storeIds: ids, source: 'MANUAL' },
                      })
                    }
                  />
                )}
                {String(draft.config.source) === 'FEATURED' && (
                  <>
                    <p className="text-sm text-gray-600">
                      محلات مميزة من التخطيط — تُحفظ مع البلوك عند الحفظ.
                    </p>
                    {layoutSections.find((s) => s.id === 'featured') && (
                      <p className="text-xs text-gray-500">
                        {layoutSections.find((s) => s.id === 'featured')?.storeIds.length ?? 0}{' '}
                        محل في القسم
                      </p>
                    )}
                  </>
                )}
                <Select
                  label="التخطيط"
                  value={String(draft.config.layout ?? 'HORIZONTAL')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      config: { ...draft.config, layout: e.target.value as StoreSectionLayout },
                    })
                  }
                  options={[
                    { value: 'HORIZONTAL', label: 'صف أفقي' },
                    { value: 'GRID', label: 'شبكة عمودين' },
                  ]}
                />
                <Input
                  label="الحد الأقصى"
                  type="number"
                  min={1}
                  max={48}
                  value={String(draft.config.limit ?? 12)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      config: { ...draft.config, limit: Number(e.target.value) || 12 },
                    })
                  }
                />
              </>
            )}

            {draft.type === 'EDITORIAL_PROMO' && (
              <>
                <Select
                  label="الحملة / الإعلان"
                  value={String(draft.config.campaignId ?? '')}
                  onChange={(e) => {
                    const camp = campaignById[e.target.value];
                    setDraft({
                      ...draft,
                      title: camp?.title ?? draft.title,
                      config: { ...draft.config, campaignId: e.target.value },
                    });
                    setMoodChipsDraft(camp?.chips ? [...camp.chips] : []);
                  }}
                  options={uniqueCampaignOptions.map((o) => ({
                    value: o.campaignId,
                    label: o.label,
                  }))}
                />
                {(() => {
                  const cid = String(draft.config.campaignId ?? '');
                  const camp = campaignById[cid];
                  if (!camp || !isMoodType(camp.type)) return null;
                  return (
                    <div className="border border-teal-100 rounded-xl p-3 bg-teal-50/40">
                      <p className="text-sm font-bold text-teal-900 mb-2">
                        شو جاي عبالك اليوم — أيقونات المزاج
                      </p>
                      <MoodChipsEditor
                        chips={moodChipsDraft}
                        onChange={setMoodChipsDraft}
                        onUploadError={(msg) => addToast(msg, 'error')}
                        pillars={pillars}
                        stores={tenants}
                      />
                    </div>
                  );
                })()}
              </>
            )}

            {draft.type === 'CUSTOM_IMAGE_BANNER' && (
              <>
                <div className="flex gap-2 items-end">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleBannerUpload(f);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 ms-1" />
                    رفع صورة
                  </Button>
                  {draft.config.imageUrl ? (
                    <img
                      src={String(draft.config.imageUrl)}
                      alt=""
                      className="h-14 w-24 object-cover rounded-lg"
                    />
                  ) : null}
                </div>
                <Input
                  label="عنوان البانر"
                  value={String(draft.config.title ?? '')}
                  onChange={(e) =>
                    setDraft({ ...draft, config: { ...draft.config, title: e.target.value } })
                  }
                />
                <Input
                  label="نص فرعي"
                  value={String(draft.config.subtitle ?? '')}
                  onChange={(e) =>
                    setDraft({ ...draft, config: { ...draft.config, subtitle: e.target.value } })
                  }
                />
                <Input
                  label="نص الزر"
                  value={String(draft.config.ctaLabel ?? '')}
                  onChange={(e) =>
                    setDraft({ ...draft, config: { ...draft.config, ctaLabel: e.target.value } })
                  }
                />
                <Input
                  label="رابط الزر (اختياري)"
                  value={String(draft.config.targetUrl ?? '')}
                  onChange={(e) =>
                    setDraft({ ...draft, config: { ...draft.config, targetUrl: e.target.value } })
                  }
                />
              </>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                إلغاء
              </Button>
              <Button onClick={saveDraft}>تم</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
