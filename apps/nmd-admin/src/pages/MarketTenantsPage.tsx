import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, useToast } from '@nmd/ui';
import { MockApiClient, type RegistryTenant } from '@nmd/mock';
import { listCategories } from '../api';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface Market {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

/** Normalized category for dropdown (supports id, title, nameAr from /categories). */
interface CategoryOption {
  id: string;
  title: string;
  icon?: string;
  sortOrder: number;
  legacyCode?: string;
}

function normalizeCategories(raw: unknown[]): CategoryOption[] {
  return raw.map((c) => {
    const o = c as Record<string, unknown>;
    const id = String(o?.id ?? '').trim();
    const title = String(o?.nameAr ?? o?.title ?? '').trim() || id;
    return {
      id,
      title,
      icon: typeof o?.icon === 'string' ? o.icon : undefined,
      sortOrder: typeof o?.sortOrder === 'number' ? o.sortOrder : 999,
      legacyCode: typeof o?.legacyCode === 'string' ? o.legacyCode : undefined,
    };
  }).filter((c) => c.id);
}

export default function MarketTenantsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketFilter, setMarketFilter] = useState<string>('');

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
  });

  /** Categories from /categories only — no static list. Renders only API data. */
  const { data: categoriesRaw = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategories(),
    enabled: !!MOCK_API_URL,
  });
  const categories: CategoryOption[] = Array.isArray(categoriesRaw) ? normalizeCategories(categoriesRaw) : [];
  useEffect(() => {
    if (import.meta.env?.DEV && categoriesRaw?.length !== undefined) {
      console.log('Categories from /categories:', categoriesRaw);
    }
  }, [categoriesRaw]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RegistryTenant> }) => {
      const result = await api.updateTenant(id, updates);
      if (result === null) throw new Error('فشل الحفظ');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      addToast('تم الحفظ', 'success');
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل الحفظ', 'error');
    },
  });

  useEffect(() => {
    if (!MOCK_API_URL) return;
    fetch(`${MOCK_API_URL}/markets?all=true`)
      .then((r) => r.json())
      .then(setMarkets)
      .catch(() => setMarkets([]));
  }, []);

  const filteredTenants = marketFilter
    ? tenants.filter((t) => (t as RegistryTenant & { marketId?: string }).marketId === marketFilter)
    : tenants;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">إدارة المستأجرين في الأسواق</h1>
      </div>

      {!MOCK_API_URL && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          لتخزين التعديلات، شغّل mock-api وضبط VITE_MOCK_API_URL (مثال: http://localhost:5190)
        </div>
      )}

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">تصفية بالسوق:</label>
          <select
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
          >
            <option value="">جميع الأسواق</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        {tenantsLoading ? (
          <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
        ) : filteredTenants.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {marketFilter ? 'لا يوجد مستأجرون في هذا السوق' : 'لا يوجد مستأجرون'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius)] border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">المستأجر</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">السوق التابع له</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">التصنيف</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">ظاهر في السوق</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">ترتيب</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((t) => (
                  <MarketTenantRow
                    key={t.id}
                    tenant={t}
                    markets={markets}
                    categories={categories}
                    onSave={(updates) => updateMutation.mutate({ id: t.id, updates })}
                    isSaving={updateMutation.isPending && updateMutation.variables?.id === t.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const norm = (s: string) => (s ?? '').trim().toLowerCase();

/** Resolve tenant's marketCategory to the exact category id from /categories (case-insensitive). */
function resolveCategoryId(tenantMc: string | undefined, categories: CategoryOption[]): string {
  const raw = tenantMc?.trim() ?? 'GENERAL';
  if (!raw) return categories[0]?.id ?? raw;
  const byId = categories.find((c) => norm(c.id) === norm(raw));
  if (byId) return byId.id;
  const byLegacy = categories.find((c) => c.legacyCode && norm(c.legacyCode) === norm(raw));
  if (byLegacy) return byLegacy.id;
  return raw;
}

/** Ensure saved value is the exact id from the categories list (case-insensitive match). */
function toSavedCategoryId(value: string, categories: CategoryOption[]): string {
  const byId = categories.find((c) => norm(c.id) === norm(value));
  if (byId) return byId.id;
  const byLegacy = categories.find((c) => c.legacyCode && norm(c.legacyCode) === norm(value));
  if (byLegacy) return byLegacy.id;
  return value;
}

interface MarketTenantRowProps {
  tenant: RegistryTenant;
  markets: Market[];
  categories: CategoryOption[];
  onSave: (updates: Partial<RegistryTenant>) => void;
  isSaving: boolean;
}

function MarketTenantRow({ tenant, markets, categories, onSave, isSaving }: MarketTenantRowProps) {
  const resolvedCategoryId = resolveCategoryId(tenant.marketCategory, categories);
  const [marketId, setMarketId] = useState(tenant.marketId ?? '');
  const [marketCategoryId, setMarketCategoryId] = useState(resolvedCategoryId);
  const [isListedInMarket, setIsListedInMarket] = useState(tenant.isListedInMarket !== false);
  const [marketSortOrder, setMarketSortOrder] = useState(String(tenant.marketSortOrder ?? 0));

  useEffect(() => {
    setMarketId(tenant.marketId ?? '');
    setMarketCategoryId(resolveCategoryId(tenant.marketCategory, categories));
    setIsListedInMarket(tenant.isListedInMarket !== false);
    setMarketSortOrder(String(tenant.marketSortOrder ?? 0));
  }, [tenant.marketId, tenant.marketCategory, tenant.isListedInMarket, tenant.marketSortOrder, categories]);

  const handleSave = () => {
    const order = parseInt(marketSortOrder, 10);
    const savedCategoryId = toSavedCategoryId(marketCategoryId, categories);
    onSave({
      marketId: marketId || undefined,
      marketCategory: savedCategoryId as RegistryTenant['marketCategory'],
      isListedInMarket,
      marketSortOrder: isNaN(order) ? 0 : order,
    });
  };

  const hasChanges =
    (tenant.marketId ?? '') !== marketId ||
    resolvedCategoryId !== marketCategoryId ||
    (tenant.isListedInMarket !== false) !== isListedInMarket ||
    String(tenant.marketSortOrder ?? 0) !== marketSortOrder;

  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            {tenant.name.charAt(0)}
          </div>
          <span className="font-medium">{tenant.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <select
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="h-9 px-2 rounded border border-gray-300 bg-white text-sm min-w-[140px]"
        >
          <option value="">—</option>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={marketCategoryId}
          onChange={(e) => setMarketCategoryId(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="h-9 px-2 rounded border border-gray-300 bg-white text-sm min-w-[120px]"
        >
          {categories.length === 0 ? (
            <option value={marketCategoryId}>— جاري التحميل أو لا توجد تصنيفات</option>
          ) : (
            categories
              .slice()
              .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
              .map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon ? `${cat.icon} ` : ''}{cat.title}
                </option>
              ))
          )}
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsListedInMarket((v) => !v);
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isListedInMarket ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              isListedInMarket ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={marketSortOrder}
          onChange={(e) => setMarketSortOrder(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-20 h-9 px-2 rounded border border-gray-300 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? '...' : 'حفظ'}
        </Button>
      </td>
    </tr>
  );
}
