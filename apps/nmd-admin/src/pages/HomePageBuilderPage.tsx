import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Modal, Select, useToast } from '@nmd/ui';
import {
  Copy,
  GripVertical,
  LayoutTemplate,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  apiFetch,
  apiUploadSingleImage,
  getHomeFeedSettings,
  listMarketFeedCampaigns,
  saveHomeFeedSettings,
  saveMarketFeedCampaigns,
} from '../api';
import {
  asArray,
  normalizeMarketsList,
  normalizePillarsList,
  normalizeTenantsList,
} from '../lib/feedCampaignNormalize';
import FeedCampaignPreview from '../components/feed/FeedCampaignPreview';
import MoodChipsEditor from '../components/feed/MoodChipsEditor';
import {
  DEFAULT_HOME_FEED_SETTINGS,
  FEED_CAMPAIGN_ACTION_LABELS,
  FEED_CAMPAIGN_KIND_LABELS,
  FIXED_HOME_BLOCKS,
  HOME_FEED_PROMO_HELPER_AR,
  PRIMARY_CAMPAIGN_TYPE_CARDS,
  PRIMARY_FEED_PLACEMENTS,
  FEED_CAMPAIGN_PLACEMENT_LABELS,
  createFeedCampaign,
  defaultsForCampaignType,
  feedCampaignsSnapshotKey,
  isMoodType,
  normalizeFeedCampaignPlacement,
  normalizeFeedCampaignType,
  placementPreviewLabel,
  sanitizeFeedCampaignsForSave,
  validateFeedCampaign,
  type FeedCampaign,
  type FeedCampaignAction,
  type FeedCampaignChip,
  type FeedCampaignKind,
  type FeedCampaignPlacement,
  type HomeFeedSettings,
} from '../types/feedCampaign';

const KIND_OPTIONS = (Object.keys(FEED_CAMPAIGN_KIND_LABELS) as FeedCampaignKind[]).map((k) => ({
  value: k,
  label: FEED_CAMPAIGN_KIND_LABELS[k],
}));

const ACTION_OPTIONS = (Object.keys(FEED_CAMPAIGN_ACTION_LABELS) as FeedCampaignAction[]).map((a) => ({
  value: a,
  label: FEED_CAMPAIGN_ACTION_LABELS[a],
}));

const PLACEMENT_OPTIONS = PRIMARY_FEED_PLACEMENTS.map((p) => ({
  value: p,
  label: FEED_CAMPAIGN_PLACEMENT_LABELS[p],
}));

const emptyDraft = (): Omit<FeedCampaign, 'id' | 'sortOrder'> => ({
  title: '',
  subtitle: '',
  imageUrl: '',
  type: 'MOOD_DISCOVERY',
  ctaLabel: 'اكتشف',
  ctaAction: 'OPEN_CATEGORY',
  targetId: '',
  targetUrl: '',
  popupBody: '',
  active: true,
  placement: 'AFTER_FIRST_SECTION',
  priority: 50,
  startDate: '',
  endDate: '',
  categoryLabels: [],
  chips: [],
  backgroundStyle: 'tealGradient',
  designVariant: 'soft_teal',
  visualWeight: 'light',
  afterEveryNSections: 2,
  allowAdjacentLargeVisual: false,
});

const DEFAULT_MOOD_CHIPS: FeedCampaignChip[] = [
  { label: 'بيتزا', emoji: '🍕', action: 'OPEN_CATEGORY', active: true, sortOrder: 1 },
  { label: 'برجر', emoji: '🍔', action: 'OPEN_CATEGORY', active: true, sortOrder: 2 },
  { label: 'شاورما', emoji: '🌯', action: 'OPEN_CATEGORY', active: true, sortOrder: 3 },
  { label: 'كوفي', emoji: '☕', action: 'OPEN_CATEGORY', active: true, sortOrder: 4 },
];

function layoutSettingsKey(s: HomeFeedSettings): string {
  return JSON.stringify({ ...DEFAULT_HOME_FEED_SETTINGS, ...s });
}

function campaignNeedsImage(type: FeedCampaignKind): boolean {
  const t = normalizeFeedCampaignType(type);
  return (
    t === 'STORE_FEATURE' ||
    t === 'FEATURED_STORE_STORY' ||
    t === 'HERO_BANNER' ||
    t === 'CUSTOM_BANNER' ||
    t === 'OFFER_STRIP' ||
    t === 'COMPETITION_CARD'
  );
}

function campaignShowsCtaFields(type: FeedCampaignKind): boolean {
  const t = normalizeFeedCampaignType(type);
  return !isMoodType(t) && t !== 'STORE_FEATURE';
}

export default function HomePageBuilderPage() {
  const addToast = useToast().addToast;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [marketSlug, setMarketSlug] = useState('dabburiyya');
  const [typeFilter, setTypeFilter] = useState<FeedCampaignKind | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [dragId, setDragId] = useState<string | null>(null);
  const [workingItems, setWorkingItems] = useState<FeedCampaign[]>([]);
  const [serverSnapshotKey, setServerSnapshotKey] = useState('');
  const [layoutDraft, setLayoutDraft] = useState<HomeFeedSettings>(DEFAULT_HOME_FEED_SETTINGS);
  const [serverLayoutKey, setServerLayoutKey] = useState(layoutSettingsKey(DEFAULT_HOME_FEED_SETTINGS));

  const { data: markets = [] } = useQuery({
    queryKey: ['markets-list-home-builder'],
    queryFn: async () => normalizeMarketsList(await apiFetch<unknown>('/markets')),
  });

  const { data: marketTenants = [] } = useQuery({
    queryKey: ['market-tenants-home-builder', marketSlug],
    queryFn: async () =>
      normalizeTenantsList(
        await apiFetch<unknown>(`/markets/${encodeURIComponent(marketSlug)}/tenants`),
      ),
    enabled: !!marketSlug.trim(),
  });

  const { data: pillars = [] } = useQuery({
    queryKey: ['pillars-home-builder'],
    queryFn: async () => normalizePillarsList(await apiFetch<unknown>('/pillars')),
  });

  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['feed-campaigns', marketSlug],
    queryFn: () => listMarketFeedCampaigns(marketSlug),
    enabled: !!marketSlug.trim(),
  });

  const { data: feedSettings = DEFAULT_HOME_FEED_SETTINGS } = useQuery({
    queryKey: ['home-feed-settings', marketSlug],
    queryFn: () => getHomeFeedSettings(marketSlug),
    enabled: !!marketSlug.trim(),
  });

  useEffect(() => {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || b.priority - a.priority);
    setWorkingItems(sorted);
    setServerSnapshotKey(feedCampaignsSnapshotKey(sorted));
  }, [items, marketSlug]);

  useEffect(() => {
    const merged = { ...DEFAULT_HOME_FEED_SETTINGS, ...feedSettings };
    setLayoutDraft(merged);
    setServerLayoutKey(layoutSettingsKey(merged));
  }, [feedSettings, marketSlug]);

  const campaignsDirty = feedCampaignsSnapshotKey(workingItems) !== serverSnapshotKey;
  const layoutDirty = layoutSettingsKey(layoutDraft) !== serverLayoutKey;

  const saveMutation = useMutation({
    mutationFn: (next: FeedCampaign[]) =>
      saveMarketFeedCampaigns(marketSlug, sanitizeFeedCampaignsForSave(next)),
    onSuccess: async (data, variables) => {
      const expectedKey = feedCampaignsSnapshotKey(sanitizeFeedCampaignsForSave(variables));
      queryClient.setQueryData(['feed-campaigns', marketSlug], data);
      const { data: refetched } = await refetch();
      const serverList = refetched ?? data;
      const sorted = [...serverList].sort(
        (a, b) => a.sortOrder - b.sortOrder || b.priority - a.priority,
      );
      setWorkingItems(sorted);
      const confirmedKey = feedCampaignsSnapshotKey(sorted);
      setServerSnapshotKey(confirmedKey);
      if (confirmedKey !== expectedKey) {
        addToast('فشل التحقق من الحفظ — أعد تحميل الصفحة وتحقق من البيانات', 'error');
        return;
      }
      addToast(`تم حفظ ${sorted.length} حملة على الخادم`, 'success');
    },
    onError: (e: Error) => addToast(e.message || 'فشل الحفظ', 'error'),
  });

  const settingsMutation = useMutation({
    mutationFn: (next: HomeFeedSettings) => saveHomeFeedSettings(marketSlug, next),
    onSuccess: (data) => {
      const merged = { ...DEFAULT_HOME_FEED_SETTINGS, ...data };
      queryClient.setQueryData(['home-feed-settings', marketSlug], data);
      setLayoutDraft(merged);
      setServerLayoutKey(layoutSettingsKey(merged));
      addToast('تم حفظ إعدادات التخطيط', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const saveAllCampaigns = () => {
    if (saveMutation.isPending) return;
    for (const c of workingItems) {
      const errors = validateFeedCampaign(sanitizeFeedCampaignsForSave([c])[0]!);
      const blocking = errors.filter(
        (e) =>
          !e.startsWith('تحذير:') &&
          (e.startsWith('العنوان') ||
            e.startsWith('معرّف') ||
            e.startsWith('المحل') ||
            e.startsWith('الصورة') ||
            e.startsWith('الوصف') ||
            e.startsWith('هدف') ||
            e.startsWith('أضف') ||
            e.startsWith('عنصر')),
      );
      if (blocking.length) {
        addToast(`${c.title || 'كتلة'}: ${blocking[0]}`, 'error');
        return;
      }
    }
    saveMutation.mutate(workingItems);
  };

  const sortedItems = useMemo(
    () => [...workingItems].sort((a, b) => a.sortOrder - b.sortOrder || b.priority - a.priority),
    [workingItems],
  );

  const filtered = useMemo(() => {
    return sortedItems.filter((c) => (typeFilter === 'all' ? true : c.type === typeFilter));
  }, [sortedItems, typeFilter]);

  const previewRows = useMemo(() => {
    const editorial = sortedItems.filter((c) => c.active);
    return [
      ...FIXED_HOME_BLOCKS.map((b) => ({ kind: 'fixed' as const, label: b.label, id: b.id })),
      ...editorial.map((c) => ({
        kind: 'editorial' as const,
        label: `${FEED_CAMPAIGN_KIND_LABELS[c.type]} · ${c.title}`,
        id: c.id,
        placement: c.placement,
      })),
    ];
  }, [sortedItems]);

  const openCreate = (type?: FeedCampaignKind) => {
    setEditingId(null);
    const base = emptyDraft();
    if (type) {
      Object.assign(base, defaultsForCampaignType(type));
      base.type = type;
    }
    if (isMoodType(base.type) && !base.chips?.length) {
      base.chips = DEFAULT_MOOD_CHIPS;
    }
    setDraft(base);
    setModalOpen(true);
  };

  const draftType = normalizeFeedCampaignType(draft.type);
  const draftValidation = useMemo(() => {
    const probe: FeedCampaign = {
      ...createFeedCampaign({
        ...draft,
        sortOrder: 0,
        type: draftType,
        placement: normalizeFeedCampaignPlacement(draft.placement),
      }),
      id: editingId ?? 'draft',
    };
    return validateFeedCampaign(sanitizeFeedCampaignsForSave([probe])[0]!);
  }, [draft, draftType, editingId]);

  const openEdit = (c: FeedCampaign) => {
    setEditingId(c.id);
    setDraft({
      title: c.title,
      subtitle: c.subtitle,
      imageUrl: c.imageUrl ?? '',
      type: c.type,
      ctaLabel: c.ctaLabel,
      ctaAction: c.ctaAction,
      targetId: c.targetId ?? '',
      targetUrl: c.targetUrl ?? '',
      popupBody: c.popupBody ?? '',
      active: c.active,
      placement: normalizeFeedCampaignPlacement(c.placement),
      manualAfterSection: c.manualAfterSection,
      priority: c.priority,
      startDate: c.startDate ?? '',
      endDate: c.endDate ?? '',
      participantCount: c.participantCount,
      countdownEndsAt: c.countdownEndsAt ?? '',
      categoryLabels: asArray<string>(c.categoryLabels),
      chips: asArray<FeedCampaignChip>(c.chips),
      backgroundStyle: c.backgroundStyle ?? 'tealGradient',
      designVariant: c.designVariant ?? 'soft_teal',
      visualWeight: c.visualWeight ?? 'light',
      afterEveryNSections: c.afterEveryNSections ?? 2,
      allowAdjacentLargeVisual: c.allowAdjacentLargeVisual ?? false,
      titleColor: c.titleColor,
      backgroundColor: c.backgroundColor,
      iconEmoji: c.iconEmoji,
    });
    setModalOpen(true);
  };

  const applyModalToWorking = () => {
    const normalizedType = normalizeFeedCampaignType(draft.type);
    const payload: FeedCampaign = editingId
      ? {
          ...workingItems.find((c) => c.id === editingId)!,
          ...draft,
          id: editingId,
          type: normalizedType,
          placement: normalizeFeedCampaignPlacement(draft.placement),
        }
      : createFeedCampaign({
          ...draft,
          sortOrder: Date.now(),
          type: normalizedType,
          placement: normalizeFeedCampaignPlacement(draft.placement),
        });

    const sanitized = sanitizeFeedCampaignsForSave([payload])[0]!;
    const errors = validateFeedCampaign(sanitized);
    const blocking = errors.filter(
      (e) =>
        !e.startsWith('تحذير:') &&
        (e.startsWith('العنوان') ||
          e.startsWith('معرّف') ||
          e.startsWith('المحل') ||
          e.startsWith('الصورة') ||
          e.startsWith('الوصف') ||
          e.startsWith('هدف') ||
          e.startsWith('أضف') ||
          e.startsWith('عنصر')),
    );
    if (blocking.length) {
      addToast(blocking[0]!, 'error');
      return false;
    }
    if (errors.length) addToast(errors[0]!, 'error');

    if (editingId) {
      setWorkingItems((prev) => prev.map((c) => (c.id === editingId ? sanitized : c)));
    } else {
      setWorkingItems((prev) => [sanitized, ...prev]);
    }
    setModalOpen(false);
    return true;
  };

  const duplicate = (c: FeedCampaign) => {
    setWorkingItems((prev) => [
      createFeedCampaign({ ...c, title: `${c.title} (نسخة)`, sortOrder: Date.now() }),
      ...prev,
    ]);
  };

  const toggleActive = (id: string) => {
    setWorkingItems((prev) => prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)));
  };

  const remove = (id: string) => {
    setWorkingItems((prev) => prev.filter((c) => c.id !== id));
  };

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = sortedItems.findIndex((c) => c.id === dragId);
    const to = sortedItems.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...sortedItems];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setWorkingItems(next.map((c, i) => ({ ...c, sortOrder: i })));
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await apiUploadSingleImage(file);
      setDraft((d) => ({ ...d, imageUrl: url }));
      addToast('تم رفع الصورة', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل الرفع', 'error');
    } finally {
      setUploading(false);
    }
  };

  const saveLayoutSettings = () => {
    settingsMutation.mutate({ ...DEFAULT_HOME_FEED_SETTINGS, ...layoutDraft });
  };

  const discardCampaignChanges = () => {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || b.priority - a.priority);
    setWorkingItems(sorted);
    setServerSnapshotKey(feedCampaignsSnapshotKey(sorted));
  };

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {(campaignsDirty || layoutDirty) && (
        <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-amber-900">يوجد تغييرات غير محفوظة</span>
          <div className="flex flex-wrap gap-2">
            {campaignsDirty && (
              <>
                <Button size="sm" variant="ghost" onClick={discardCampaignChanges}>
                  تراجع
                </Button>
                <Button
                  size="sm"
                  onClick={saveAllCampaigns}
                  disabled={!campaignsDirty || saveMutation.isPending}
                  className="gap-1"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الحملات'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <LayoutTemplate className="h-7 w-7 text-teal-600" />
            بناء الصفحة الرئيسية
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{HOME_FEED_PROMO_HELPER_AR}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCreate()} className="gap-2">
            <Plus className="h-4 w-4" />
            كتلة متقدمة
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="font-bold text-gray-900 mb-3">أنواع الحملات — اختر نوعاً لإنشاء كتلة</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRIMARY_CAMPAIGN_TYPE_CARDS.map((card) => (
            <button
              key={card.type}
              type="button"
              onClick={() => openCreate(card.type)}
              className="text-right rounded-xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/60 p-4 hover:border-teal-300 hover:shadow-sm transition"
            >
              <p className="font-bold text-teal-900">{card.titleAr}</p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{card.descriptionAr}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[180px]">
          <Select
            label="السوق"
            options={markets.map((m) => ({
              value: m.slug,
              label: m.nameAr || m.name || m.slug,
            }))}
            value={marketSlug}
            onChange={(e) => setMarketSlug(e.target.value)}
          />
        </div>
        <div className="min-w-[160px]">
          <Select
            label="النوع"
            options={[{ value: 'all', label: 'الكل' }, ...KIND_OPTIONS]}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as FeedCampaignKind | 'all')}
          />
        </div>
        <Button
          onClick={saveAllCampaigns}
          disabled={!campaignsDirty || saveMutation.isPending}
          className="gap-2 mr-auto"
        >
          <Save className="h-4 w-4" />
          حفظ الكل
        </Button>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1 space-y-3">
          <h2 className="font-bold text-gray-900">إعدادات التخطيط</h2>
          <Input
            label="أقصى إعلانات في الرئيسية"
            type="number"
            value={String(
              layoutDraft.maxPromoBlocksPerHome ??
                layoutDraft.maxBlocksPerHome ??
                feedSettings.maxPromoBlocksPerHome ??
                feedSettings.maxBlocksPerHome,
            )}
            onChange={(e) => {
              const n = Number(e.target.value) || 0;
              setLayoutDraft((d) => ({
                ...d,
                maxPromoBlocksPerHome: n,
                maxBlocksPerHome: n,
              }));
            }}
          />
          <Input
            label="أقسام محلات بين الإعلانات"
            type="number"
            value={String(
              layoutDraft.minStoreSectionsBetweenPromos ??
                feedSettings.minStoreSectionsBetweenPromos ??
                2,
            )}
            onChange={(e) =>
              setLayoutDraft((d) => ({
                ...d,
                minStoreSectionsBetweenPromos: Number(e.target.value) || 2,
              }))
            }
          />
          <Input
            label="أول إعلان بعد قسم رقم"
            type="number"
            value={String(
              layoutDraft.firstPromoAfterSectionIndex ??
                feedSettings.firstPromoAfterSectionIndex ??
                1,
            )}
            onChange={(e) =>
              setLayoutDraft((d) => ({
                ...d,
                firstPromoAfterSectionIndex: Number(e.target.value) || 1,
              }))
            }
          />
          <Select
            label="تباعد"
            options={[
              { value: 'compact', label: 'مضغوط' },
              { value: 'normal', label: 'عادي' },
              { value: 'spacious', label: 'واسع' },
            ]}
            value={layoutDraft.spacingStyle ?? feedSettings.spacingStyle}
            onChange={(e) =>
              setLayoutDraft((d) => ({
                ...d,
                spacingStyle: e.target.value as HomeFeedSettings['spacingStyle'],
              }))
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={layoutDraft.preventAdjacentLargeVisual ?? true}
              onChange={(e) =>
                setLayoutDraft((d) => ({ ...d, preventAdjacentLargeVisual: e.target.checked }))
              }
            />
            منع بانرين كبيرين متجاورين
          </label>
          <Button
            size="sm"
            onClick={saveLayoutSettings}
            disabled={!layoutDirty || settingsMutation.isPending}
          >
            حفظ الإعدادات
          </Button>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="font-bold text-gray-900 mb-3">معاينة ترتيب الصفحة</h2>
          <ol className="space-y-2 text-sm">
            {previewRows.map((row, i) => (
              <li
                key={`${row.id}-${i}`}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                  row.kind === 'fixed' ? 'bg-gray-50 text-gray-600' : 'bg-teal-50 text-teal-900'
                }`}
              >
                <span className="text-xs font-mono text-gray-400">{i + 1}</span>
                {row.kind === 'fixed' ? (
                  <span>{row.label} (ثابت)</span>
                ) : (
                  <span>
                    {row.label}
                    {'placement' in row && row.placement
                      ? ` · ${placementPreviewLabel(row.placement as FeedCampaignPlacement)}`
                      : ''}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-gray-500">جاري التحميل...</p>
      ) : isError ? (
        <Card className="p-6 text-center text-red-600">
          فشل تحميل الحملات: {error instanceof Error ? error.message : 'خطأ غير معروف'}
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          لا توجد كتل تحريرية — الصفحة تعرض المحلات فقط حتى تضيف كتل من الأزرار أعلاه.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="overflow-hidden flex flex-col"
              draggable
              onDragStart={() => setDragId(c.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorder(c.id)}
            >
              {c.imageUrl ? (
                <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url(${c.imageUrl})` }} />
              ) : (
                <div className="h-20 bg-gradient-to-l from-teal-600/90 to-teal-900/80 flex items-center justify-center text-white text-2xl">
                  {c.iconEmoji || (isMoodType(c.type) ? '🍕' : '✨')}
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-5 w-5 text-gray-300 shrink-0 mt-1 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-teal-700 font-semibold">{FEED_CAMPAIGN_KIND_LABELS[c.type]}</p>
                    <h3 className="font-bold text-gray-900 truncate">{c.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{c.subtitle}</p>
                  </div>
                  <button type="button" onClick={() => toggleActive(c.id)} className="shrink-0" title="تفعيل/إيقاف">
                    {c.active ? (
                      <ToggleRight className="h-8 w-8 text-teal-600" />
                    ) : (
                      <ToggleLeft className="h-8 w-8 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  يظهر: {placementPreviewLabel(c.placement)} · أولوية {c.priority}
                  {!c.active && ' · معطّل'}
                </p>
                <div className="scale-[0.85] origin-top -mb-2">
                  <FeedCampaignPreview campaign={c} />
                </div>
                <div className="flex flex-wrap gap-2 mt-auto pt-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                    تعديل
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicate(c)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'تعديل الكتلة' : 'كتلة جديدة'}
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  label="نوع الكتلة"
                  options={KIND_OPTIONS}
                  value={draft.type}
                  onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as FeedCampaignKind }))}
                />
                <Select
                  label="موضع الظهور"
                  options={PLACEMENT_OPTIONS}
                  value={normalizeFeedCampaignPlacement(draft.placement)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      placement: e.target.value as FeedCampaignPlacement,
                    }))
                  }
                />
              </div>
              <p className="text-xs text-gray-500 -mt-2">{HOME_FEED_PROMO_HELPER_AR}</p>
              <Input
                label="العنوان *"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
              {!isMoodType(draftType) && (
                <Input
                  label={
                    draftType === 'COMPETITION_CARD' || draftType === 'OFFER_STRIP' || draftType === 'REWARD_CARD'
                      ? 'الوصف *'
                      : 'الوصف'
                  }
                  value={draft.subtitle}
                  onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
                />
              )}
              {campaignShowsCtaFields(draftType) && (
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    label="إجراء الزر"
                    options={ACTION_OPTIONS}
                    value={draft.ctaAction}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, ctaAction: e.target.value as FeedCampaignAction }))
                    }
                  />
                  <Input
                    label="نص الزر"
                    value={draft.ctaLabel}
                    onChange={(e) => setDraft((d) => ({ ...d, ctaLabel: e.target.value }))}
                  />
                </div>
              )}
              <Input
                label="الأولوية"
                type="number"
                value={String(draft.priority)}
                onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) || 0 }))}
              />
              {(draft.placement === 'MANUAL_PRIORITY' || draft.placement === 'MANUAL_ORDER') && (
                <Input
                  label="بعد القسم (0 = الأول)"
                  type="number"
                  value={String(draft.manualAfterSection ?? 0)}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, manualAfterSection: Number(e.target.value) }))
                  }
                />
              )}
              {(draft.ctaAction === 'OPEN_STORE' || draftType === 'STORE_FEATURE') && (
                <Select
                  label="المحل المستهدف *"
                  options={[
                    { value: '', label: '— اختر محل —' },
                    ...marketTenants.map((t) => ({
                      value: t.id,
                      label: t.name || t.slug || t.id,
                    })),
                  ]}
                  value={draft.targetId ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, targetId: e.target.value, ctaAction: 'OPEN_STORE' }))
                  }
                />
              )}
              {draft.ctaAction === 'OPEN_CATEGORY' &&
                draftType !== 'STORE_FEATURE' &&
                !isMoodType(draftType) && (
                <Select
                  label="التصنيف / العمود *"
                  options={[
                    { value: '', label: '— اختر تصنيف —' },
                    ...pillars.map((p) => ({
                      value: p.id,
                      label: p.nameAr || p.title || p.id,
                    })),
                  ]}
                  value={draft.targetId ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, targetId: e.target.value }))}
                />
              )}
              {draft.ctaAction === 'OPEN_SEARCH' && !isMoodType(draftType) && (
                <Input
                  label="عبارة البحث *"
                  value={draft.targetId ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, targetId: e.target.value }))}
                />
              )}
              {isMoodType(draftType) && (
                <MoodChipsEditor
                  chips={asArray<FeedCampaignChip>(draft.chips)}
                  onChange={(chips) => setDraft((d) => ({ ...d, chips }))}
                  onUploadError={(msg) => addToast(msg, 'error')}
                  pillars={pillars}
                  stores={marketTenants}
                />
              )}
              {campaignNeedsImage(draftType) && (
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? 'جاري الرفع...' : 'رفع صورة *'}
                  </Button>
                  {draft.imageUrl && (
                    <img src={draft.imageUrl} alt="" className="h-14 w-24 object-cover rounded-lg" />
                  )}
                </div>
              )}
              {draftValidation.length > 0 && (
                <ul className="text-xs text-red-600 space-y-1 rounded-lg bg-red-50 p-3">
                  {draftValidation.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2 text-center">معاينة تقريبية</p>
              <FeedCampaignPreview
                campaign={{
                  type: draft.type,
                  title: draft.title,
                  subtitle: draft.subtitle,
                  imageUrl: draft.imageUrl,
                  iconEmoji: draft.iconEmoji,
                  chips: draft.chips,
                  ctaLabel: draft.ctaLabel,
                  placement: draft.placement,
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            إلغاء
          </Button>
          <Button onClick={() => applyModalToWorking()}>
            {editingId ? 'تطبيق على القائمة' : 'إضافة للقائمة'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
