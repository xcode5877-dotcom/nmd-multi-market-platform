import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Select, useToast } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTenantOptional } from '../tenant-portal/contexts/TenantContext';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

const TENANT_TYPES = [
  { value: 'RESTAURANT', label: 'مطعم' },
  { value: 'SHOP', label: 'متجر' },
  { value: 'SERVICE', label: 'خدمة' },
];

const DELIVERY_MODES = [
  { value: 'TENANT', label: 'توصيل المستأجر (سائقون خاصون)' },
  { value: 'MARKET', label: 'توصيل السوق (سائقون السوق)' },
  { value: 'PICKUP_ONLY', label: 'استلام فقط' },
];

export default function TenantDeliverySettingsPage() {
  const params = useParams<{ id: string; tenantId: string }>();
  const tenantCtx = useTenantOptional();
  const { data: me } = useQuery({ queryKey: ['me', tenantCtx?.tenantId], queryFn: () => api.getMe(), enabled: !!MOCK_API_URL && !tenantCtx });
  const tenantId = tenantCtx?.tenantId ?? params.tenantId ?? params.id ?? me?.tenantId;
  const marketId = params.tenantId ? params.id : undefined;
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    tenantType: 'SHOP',
    deliveryProviderMode: 'TENANT',
    allowMarketCourierFallback: true,
    defaultPrepTimeMin: 30,
  });

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-registry', tenantId],
    queryFn: () => api.getTenantById(tenantId!),
    enabled: !!tenantId && !!MOCK_API_URL,
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        tenantType: (tenant as { tenantType?: string }).tenantType ?? 'SHOP',
        deliveryProviderMode: (tenant as { deliveryProviderMode?: string }).deliveryProviderMode ?? 'TENANT',
        allowMarketCourierFallback: (tenant as { allowMarketCourierFallback?: boolean }).allowMarketCourierFallback ?? true,
        defaultPrepTimeMin: (tenant as { defaultPrepTimeMin?: number }).defaultPrepTimeMin ?? 30,
      });
    }
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patchTenantDeliverySettings(tenantId!, {
        tenantType: form.tenantType,
        deliveryProviderMode: form.deliveryProviderMode,
        allowMarketCourierFallback: form.allowMarketCourierFallback,
        defaultPrepTimeMin: form.defaultPrepTimeMin,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-registry', tenantId] });
      addToast('تم الحفظ', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل الحفظ', 'error'),
  });

  if (!tenantId || !MOCK_API_URL) return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  if (isLoading) return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  if (!tenant) return <div className="p-8 text-red-600">المستأجر غير موجود</div>;

  return (
    <div>
      <Link
        to={marketId ? `/markets/${marketId}/tenants/${tenantId}` : `/tenants/${tenantId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        رجوع
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">إعدادات التوصيل - {tenant.name}</h1>

      <Card className="p-6 max-w-md">
        <div className="space-y-4">
          <Select
            label="نوع المستأجر"
            options={TENANT_TYPES}
            value={form.tenantType}
            onChange={(e) => setForm((f) => ({ ...f, tenantType: e.target.value }))}
          />
          <Select
            label="وضع التوصيل"
            options={DELIVERY_MODES}
            value={form.deliveryProviderMode}
            onChange={(e) => setForm((f) => ({ ...f, deliveryProviderMode: e.target.value }))}
          />
          {form.deliveryProviderMode === 'TENANT' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.allowMarketCourierFallback}
                onChange={(e) => setForm((f) => ({ ...f, allowMarketCourierFallback: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">السماح بالانتقال لتوصيل السوق عند التأخر</span>
            </label>
          )}
          {form.tenantType === 'RESTAURANT' && (
            <Input
              label="وقت التحضير الافتراضي (دقيقة)"
              type="number"
              min={5}
              max={120}
              value={String(form.defaultPrepTimeMin)}
              onChange={(e) => setForm((f) => ({ ...f, defaultPrepTimeMin: parseInt(e.target.value, 10) || 30 }))}
            />
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
