import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store, Building2, Plus, Loader2 } from 'lucide-react';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { apiFetch, apiHeaders } from '../api';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

interface Market {
  id: string;
  name: string;
  slug: string;
  branding?: { primaryColor?: string };
  isActive: boolean;
  sortOrder?: number;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  marketId?: string | null;
}

export default function MarketGroupsManagerPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSlug, setNewGroupSlug] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editSortOrder, setEditSortOrder] = useState<number>(0);

  const { data: marketsData = [], isLoading: marketsLoading } = useQuery({
    queryKey: ['markets', 'all'],
    queryFn: () =>
      fetch(`${MOCK_API_URL}/markets?all=true`, { headers: apiHeaders() }).then((r) => r.json()),
    enabled: !!MOCK_API_URL,
  });
  const markets: Market[] = (Array.isArray(marketsData) ? marketsData : []).sort(
    (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
  );

  const { data: tenantsData = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants', 'all'],
    queryFn: () => api.listTenants(),
    enabled: !!MOCK_API_URL,
  });
  const tenants: TenantRow[] = (tenantsData as { id: string; name?: string; slug?: string; marketId?: string | null }[]).map((t) => ({
    id: t.id,
    name: t.name ?? t.slug ?? t.id,
    slug: t.slug ?? '',
    marketId: t.marketId ?? null,
  }));

  const createMarketMutation = useMutation({
    mutationFn: async (payload: { name: string; slug: string }) => {
      return apiFetch<Market>('/markets', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          slug: payload.slug,
          branding: { primaryColor: '#D97706' },
          isActive: true,
        }),
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['markets', 'all'] });
      setCreating(false);
      setNewGroupName('');
      setNewGroupSlug('');
      setSelectedMarketId(created.id);
      addToast('تم إنشاء مجموعة السوق بنجاح', 'success');
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل الإنشاء', 'error');
    },
  });

  const updateMarketMutation = useMutation({
    mutationFn: async ({ marketId, name, sortOrder }: { marketId: string; name: string; sortOrder: number }) => {
      return apiFetch<Market>(`/markets/${marketId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), sortOrder }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets', 'all'] });
      addToast('تم حفظ الإعدادات', 'success');
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل الحفظ', 'error');
    },
  });

  const assignTenantMutation = useMutation({
    mutationFn: async ({ tenantId, marketId }: { tenantId: string; marketId: string | null }) => {
      const updated = await apiFetch<{ id: string; marketId?: string | null }>(`/tenants/${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ marketId }),
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل تحديث المتجر', 'error');
    },
  });

  const handleToggleStore = (tenant: TenantRow, checked: boolean) => {
    if (!selectedMarketId && checked) return;
    const newMarketId = checked ? selectedMarketId! : null;
    assignTenantMutation.mutate({ tenantId: tenant.id, marketId: newMarketId });
  };

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    const slug = newGroupSlug.trim() || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!name) {
      addToast('أدخل اسم مجموعة السوق', 'error');
      return;
    }
    createMarketMutation.mutate({ name, slug });
  };

  const selectedMarket = markets.find((m) => m.id === selectedMarketId);
  const isBusy = assignTenantMutation.isPending || createMarketMutation.isPending || updateMarketMutation.isPending;

  useEffect(() => {
    if (selectedMarket) {
      setEditDisplayName(selectedMarket.name);
      setEditSortOrder(selectedMarket.sortOrder ?? 0);
    }
  }, [selectedMarket?.id, selectedMarket?.name, selectedMarket?.sortOrder]);

  if (!MOCK_API_URL) {
    return (
      <div className="p-8 text-gray-500" dir="rtl">
        يتطلب هذا القسم الاتصال بواجهة API.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">مدير مجموعات الأسواق</h1>
        <p className="text-gray-600 mt-1">
          حدد مجموعة سوق من اليسار، ثم علّق المتاجر التي تنتمي إليها. المتاجر في نفس المجموعة يمكن طلبها معاً في سلة واحدة.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left: Market Groups */}
        <Card className="p-4 h-fit">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            مجموعات الأسواق
          </h2>

          {creating ? (
            <div className="space-y-3 mb-4">
              <Input
                label="اسم المجموعة"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="مثال: سوق دبورية الرئيسي"
              />
              <Input
                label="Slug (اختياري)"
                value={newGroupSlug}
                onChange={(e) => setNewGroupSlug(e.target.value)}
                placeholder="dabburiyya"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateGroup}
                  disabled={createMarketMutation.isPending || !newGroupName.trim()}
                >
                  {createMarketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إنشاء'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full mb-4 gap-2"
              onClick={() => setCreating(true)}
            >
              <Plus className="w-4 h-4" />
              مجموعة سوق جديدة
            </Button>
          )}

          {marketsLoading ? (
            <div className="flex items-center gap-2 text-gray-500 py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري التحميل...
            </div>
          ) : (
            <ul className="space-y-1">
              {markets.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedMarketId(m.id)}
                    className={`w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedMarketId === m.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {m.name}
                  </button>
                </li>
              ))}
              {markets.length === 0 && !creating && (
                <p className="text-sm text-gray-500 py-4">لا توجد مجموعات. أنشئ مجموعة من الزر أعلاه.</p>
              )}
            </ul>
          )}

          {selectedMarket && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">إعدادات العرض</h3>
              <div className="space-y-3">
                <Input
                  label="اسم العرض (يظهر للعميل)"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="مثال: السوق المركزي الكبير"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ترتيب القسم (رقم)</label>
                  <input
                    type="number"
                    min={0}
                    value={editSortOrder}
                    onChange={(e) => setEditSortOrder(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-0.5">الأصغر يظهر أولاً في الصفحة</p>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={updateMarketMutation.isPending || !editDisplayName.trim() || (editDisplayName.trim() === selectedMarket.name && editSortOrder === (selectedMarket.sortOrder ?? 0))}
                  onClick={() => updateMarketMutation.mutate({ marketId: selectedMarket.id, name: editDisplayName.trim(), sortOrder: editSortOrder })}
                >
                  {updateMarketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'حفظ الإعدادات'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Right: Stores list with checkboxes */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Store className="w-5 h-5" />
            المتاجر — {selectedMarket ? selectedMarket.name : 'اختر مجموعة من اليسار'}
          </h2>

          {!selectedMarketId ? (
            <p className="text-gray-500 py-8 text-center">
              اختر مجموعة سوق من القائمة على اليسار لتعيين المتاجر إليها.
            </p>
          ) : tenantsLoading ? (
            <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري تحميل المتاجر...
            </div>
          ) : tenants.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">لا توجد متاجر مسجّلة.</p>
          ) : (
            <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
              {tenants.map((t) => {
                const isInThisGroup = t.marketId === selectedMarketId;
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100"
                  >
                    <input
                      type="checkbox"
                      id={`store-${t.id}`}
                      checked={isInThisGroup}
                      onChange={(e) => handleToggleStore(t, e.target.checked)}
                      disabled={isBusy}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor={`store-${t.id}`} className="flex-1 cursor-pointer text-sm font-medium text-gray-900">
                      {t.name}
                    </label>
                    {t.marketId && t.marketId !== selectedMarketId && (
                      <span className="text-xs text-gray-400">في مجموعة أخرى</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {selectedMarket && (
            <p className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
              المتاجر المعلّقة تنتمي إلى &quot;{selectedMarket.name}&quot;. العملاء يمكنهم إضافة منتجات من هذه المتاجر فقط في نفس السلة (قاعدة +5 شيكل لكل متجر إضافي).
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
