import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Copy,
  Eye,
  ExternalLink,
  Pencil,
  Percent,
  RotateCcw,
  Search,
  ShieldOff,
} from 'lucide-react';
import { Badge, Button, Card, Modal, useToast } from '@nmd/ui';
import { MockApiClient, type RegistryTenant } from '@nmd/mock';
import { useAuth } from '../contexts/AuthContext';
import { useEmergencyMode } from '../contexts/EmergencyModeContext';
import { apiFetch, apiHeaders } from '../api';
import PlatformFeeDisabledBanner from '../components/platform-fee/PlatformFeeDisabledBanner';
import PlatformFeePreviewModal from '../components/platform-fee/PlatformFeePreviewModal';
import {
  FEE_MODEL_SHORT_LABELS,
  FEE_SOURCE_LABELS,
  PLATFORM_FEE_MODEL_OPTIONS,
  buildTenantFeeRow,
  getEffectiveFeeConfig,
  isPlatformAdminRole,
  type FeeSourceCategory,
  type PlatformFeeConfig,
  type PlatformFeeModel,
  type TenantFeeRow,
  type TenantPlatformFeeOverride,
} from '../lib/platform-fee';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

type MarketRecord = {
  id: string;
  name: string;
  platformFeeConfig?: PlatformFeeConfig;
};

const SOURCE_BADGE: Record<FeeSourceCategory, { variant: 'default' | 'primary' | 'warning' | 'error'; className?: string }> = {
  MARKET: { variant: 'primary' },
  TENANT: { variant: 'default', className: 'bg-indigo-100 text-indigo-800' },
  EXEMPT: { variant: 'warning' },
  INACTIVE: { variant: 'error' },
};

function tenantDetailPath(row: TenantFeeRow): string {
  return row.marketId ? `/markets/${row.marketId}/tenants/${row.tenantId}` : `/tenants/${row.tenantId}`;
}

export default function PlatformFeesOverviewPage() {
  const { user } = useAuth();
  const emergency = useEmergencyMode();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const platformAdmin = isPlatformAdminRole(user?.role);
  const isRootAdmin = user?.role === 'ROOT_ADMIN';
  const canWrite =
    user?.role === 'SUPER_ADMIN' || (isRootAdmin && !!emergency?.enabled && !!emergency?.reason?.trim());

  const [marketFilter, setMarketFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<FeeSourceCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modelFilter, setModelFilter] = useState<PlatformFeeModel | ''>('');
  const [search, setSearch] = useState('');
  const [previewRow, setPreviewRow] = useState<TenantFeeRow | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<TenantFeeRow | null>(null);
  const [duplicateSourceId, setDuplicateSourceId] = useState('');

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
    enabled: !!MOCK_API_URL && platformAdmin,
  });

  const { data: marketsData = [] } = useQuery({
    queryKey: ['markets'],
    queryFn: () =>
      fetch(`${MOCK_API_URL}/markets?all=true`, { headers: apiHeaders() }).then((r) => r.json()),
    enabled: !!MOCK_API_URL && platformAdmin,
  });
  const markets: MarketRecord[] = Array.isArray(marketsData) ? marketsData : [];
  const marketById = useMemo(() => new Map(markets.map((m) => [m.id, m])), [markets]);

  const rows = useMemo(() => {
    return (tenants as RegistryTenant[]).map((t) => {
      const marketId = (t as { marketId?: string }).marketId;
      const market = marketId ? marketById.get(marketId) : undefined;
      const financialConfig = (t as { financialConfig?: TenantFeeRow['financialConfig'] }).financialConfig;
      return buildTenantFeeRow({
        tenantId: t.id,
        tenantName: t.name,
        tenantSlug: t.slug,
        marketId,
        marketName: market?.name,
        marketFeeConfig: market?.platformFeeConfig,
        financialConfig,
      });
    });
  }, [tenants, marketById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (marketFilter && r.marketId !== marketFilter) return false;
      if (sourceFilter && r.sourceCategory !== sourceFilter) return false;
      if (statusFilter === 'active' && !r.active) return false;
      if (statusFilter === 'inactive' && r.active) return false;
      if (modelFilter && r.model !== modelFilter) return false;
      if (q && !r.tenantName.toLowerCase().includes(q) && !r.tenantSlug.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, marketFilter, sourceFilter, statusFilter, modelFilter, search]);

  const stats = useMemo(() => {
    const marketDefault = rows.filter((r) => r.sourceCategory === 'MARKET').length;
    const custom = rows.filter((r) => r.sourceCategory === 'TENANT').length;
    const exempt = rows.filter((r) => r.sourceCategory === 'EXEMPT').length;
    const active = rows.filter((r) => r.active).length;
    return { total: rows.length, marketDefault, custom, exempt, active };
  }, [rows]);

  const patchPlatformFee = useMutation({
    mutationFn: async ({
      tenantId,
      platformFee,
      financialConfig,
    }: {
      tenantId: string;
      platformFee: TenantPlatformFeeOverride;
      financialConfig?: TenantFeeRow['financialConfig'];
    }) => {
      return apiFetch(`/tenants/${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          financialConfig: {
            commissionType: financialConfig?.commissionType ?? 'PERCENTAGE',
            commissionValue: financialConfig?.commissionValue ?? 10,
            deliveryFeeModel: financialConfig?.deliveryFeeModel ?? 'TENANT',
            ...financialConfig,
            platformFee,
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-registry'] });
      addToast('تم تحديث إعدادات رسوم المتجر', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل التحديث', 'error'),
  });

  const applyUseMarketDefault = (row: TenantFeeRow) => {
    if (!canWrite) {
      addToast('فعّل وضع الطوارئ (ROOT) أو استخدم SUPER_ADMIN', 'error');
      return;
    }
    patchPlatformFee.mutate({
      tenantId: row.tenantId,
      platformFee: { useMarketDefault: true },
      financialConfig: row.financialConfig,
    });
  };

  const applyExempt = (row: TenantFeeRow) => {
    if (!canWrite) {
      addToast('فعّل وضع الطوارئ (ROOT) أو استخدم SUPER_ADMIN', 'error');
      return;
    }
    patchPlatformFee.mutate({
      tenantId: row.tenantId,
      platformFee: { useMarketDefault: false, enabled: false },
      financialConfig: row.financialConfig,
    });
  };

  const applyDuplicate = () => {
    if (!duplicateTarget || !duplicateSourceId) return;
    const source = rows.find((r) => r.tenantId === duplicateSourceId);
    if (!source) return;
    const cfg = getEffectiveFeeConfig(source.marketFeeConfig, source.tenantFeeOverride);
    if (!cfg) {
      addToast('المتجر المصدر لا يملك رسومًا فعّالة للنسخ', 'error');
      return;
    }
    patchPlatformFee.mutate({
      tenantId: duplicateTarget.tenantId,
      platformFee: {
        useMarketDefault: false,
        enabled: true,
        model: cfg.model,
        percentage: cfg.percentage,
        fixedPerOrder: cfg.fixedPerOrder,
        fixedPerItem: cfg.fixedPerItem,
        minFee: cfg.minFee,
        maxFee: cfg.maxFee,
      },
      financialConfig: duplicateTarget.financialConfig,
    });
    setDuplicateTarget(null);
    setDuplicateSourceId('');
  };

  if (!MOCK_API_URL) {
    return (
      <div className="p-4 text-amber-800 bg-amber-50 rounded-lg border border-amber-200">
        لتشغيل هذه الصفحة، ضبط VITE_MOCK_API_URL
      </div>
    );
  }

  if (!platformAdmin) {
    return (
      <div className="p-8 text-center text-gray-600">
        <p>إدارة رسوم المنصة متاحة فقط لمسؤول المنصة (ROOT / SUPER).</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Percent className="w-7 h-7 text-teal-600" />
          إدارة رسوم المنصة
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          لوحة تشغيلية — عرض مصدر الرسوم ونموذجها لكل متجر. لا تُفرض رسوم على الطلبات حتى تفعيل العلم على
          الخادم.
        </p>
      </div>

      <PlatformFeeDisabledBanner />

      {isRootAdmin && !canWrite && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          وضع القراءة فقط — فعّل وضع الطوارئ مع سبب من الشريط الجانبي لتنفيذ الإجراءات السريعة.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-xs text-gray-500 mb-1">إجمالي المتاجر</div>
          <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 mb-1">إعداد السوق</div>
          <div className="text-2xl font-bold text-teal-700 tabular-nums">{stats.marketDefault}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 mb-1">إعداد خاص</div>
          <div className="text-2xl font-bold text-indigo-700 tabular-nums">{stats.custom}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 mb-1">معفى</div>
          <div className="text-2xl font-bold text-amber-700 tabular-nums">{stats.exempt}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 mb-1">رسوم مفعلة</div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{stats.active}</div>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm min-w-[140px]">
            <span className="block text-gray-600 mb-1">السوق</span>
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="w-full h-9 px-2 rounded border border-gray-300 text-sm bg-white"
            >
              <option value="">الكل</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm min-w-[140px]">
            <span className="block text-gray-600 mb-1">مصدر الرسوم</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as FeeSourceCategory | '')}
              className="w-full h-9 px-2 rounded border border-gray-300 text-sm bg-white"
            >
              <option value="">الكل</option>
              {(Object.keys(FEE_SOURCE_LABELS) as FeeSourceCategory[]).map((k) => (
                <option key={k} value={k}>
                  {FEE_SOURCE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm min-w-[120px]">
            <span className="block text-gray-600 mb-1">الحالة</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full h-9 px-2 rounded border border-gray-300 text-sm bg-white"
            >
              <option value="all">الكل</option>
              <option value="active">مفعل</option>
              <option value="inactive">غير مفعل</option>
            </select>
          </label>
          <label className="text-sm min-w-[140px]">
            <span className="block text-gray-600 mb-1">نموذج الرسوم</span>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value as PlatformFeeModel | '')}
              className="w-full h-9 px-2 rounded border border-gray-300 text-sm bg-white"
            >
              <option value="">الكل</option>
              {PLATFORM_FEE_MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {FEE_MODEL_SHORT_LABELS[o.value]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex-1 min-w-[180px]">
            <span className="block text-gray-600 mb-1">بحث</span>
            <div className="relative">
              <Search className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اسم المتجر..."
                className="w-full h-9 pr-8 pl-2 rounded border border-gray-300 text-sm"
              />
            </div>
          </label>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {tenantsLoading ? (
          <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">لا توجد نتائج</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right min-w-[960px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="px-3 py-3 font-medium">المتجر</th>
                  <th className="px-3 py-3 font-medium">السوق</th>
                  <th className="px-3 py-3 font-medium">مصدر الرسوم</th>
                  <th className="px-3 py-3 font-medium">النموذج</th>
                  <th className="px-3 py-3 font-medium">قيمة الرسوم</th>
                  <th className="px-3 py-3 font-medium">معاينة</th>
                  <th className="px-3 py-3 font-medium">الحالة</th>
                  <th className="px-3 py-3 font-medium w-44">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => {
                  const srcBadge = SOURCE_BADGE[row.sourceCategory];
                  return (
                    <tr key={row.tenantId} className="hover:bg-gray-50/80">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">{row.tenantName}</div>
                        <div className="text-xs text-gray-500">/{row.tenantSlug}</div>
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {row.marketName ? (
                          <Link
                            to={`/markets/${row.marketId}/platform-fee`}
                            className="text-primary hover:underline"
                          >
                            {row.marketName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={srcBadge.variant} className={srcBadge.className}>
                          {row.sourceLabel}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-medium">
                          {row.modelLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-800 tabular-nums text-xs max-w-[200px]">
                        {row.valueSummary}
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{row.effectivePreview}</td>
                      <td className="px-3 py-3">
                        <Badge variant={row.active ? 'primary' : 'default'}>
                          {row.active ? 'مفعل' : 'غير مفعل'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            title="معاينة"
                            onClick={() => setPreviewRow(row)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Link to={tenantDetailPath(row)} title="تعديل">
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link to={tenantDetailPath(row)} title="فتح المتجر">
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            title="استخدام إعداد السوق"
                            disabled={!canWrite || patchPlatformFee.isPending}
                            onClick={() => applyUseMarketDefault(row)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-amber-700"
                            title="إعفاء المتجر"
                            disabled={!canWrite || patchPlatformFee.isPending}
                            onClick={() => applyExempt(row)}
                          >
                            <ShieldOff className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            title="نسخ من متجر آخر"
                            disabled={!canWrite}
                            onClick={() => {
                              setDuplicateTarget(row);
                              setDuplicateSourceId('');
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
        <Building2 className="w-3.5 h-3.5" />
        {filtered.length} من {rows.length} متجر — إعدادات السوق من{' '}
        <Link to="/markets" className="text-primary hover:underline">
          صفحة الأسواق
        </Link>
      </p>

      <PlatformFeePreviewModal
        open={!!previewRow}
        onClose={() => setPreviewRow(null)}
        storeName={previewRow?.tenantName ?? ''}
        marketFeeConfig={previewRow?.marketFeeConfig}
        tenantFeeOverride={previewRow?.tenantFeeOverride}
      />

      <Modal
        open={!!duplicateTarget}
        onClose={() => {
          setDuplicateTarget(null);
          setDuplicateSourceId('');
        }}
        title={`نسخ إعدادات الرسوم — ${duplicateTarget?.tenantName ?? ''}`}
      >
        <p className="text-sm text-gray-600 mb-4">اختر متجرًا مصدرًا لنسخ إعداداته الفعّالة كـ override خاص.</p>
        <select
          value={duplicateSourceId}
          onChange={(e) => setDuplicateSourceId(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm mb-4"
        >
          <option value="">— اختر متجرًا —</option>
          {rows
            .filter((r) => r.tenantId !== duplicateTarget?.tenantId && r.active)
            .map((r) => (
              <option key={r.tenantId} value={r.tenantId}>
                {r.tenantName} ({r.sourceLabel} — {r.valueSummary})
              </option>
            ))}
        </select>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setDuplicateTarget(null)}>
            إلغاء
          </Button>
          <Button onClick={applyDuplicate} disabled={!duplicateSourceId || !canWrite}>
            نسخ الإعداد
          </Button>
        </div>
      </Modal>
    </div>
  );
}
