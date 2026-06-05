import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Button } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { MockApiClient } from '@nmd/mock';
import { formatPrice } from '@nmd/core';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

type MerchantSummary = {
  period: { from: string; to: string };
  pickupCommissionOwed: number;
  paymentsMade: number;
  remainingBalance: number;
  currency: string;
};

const PRESETS = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'أسبوع' },
  { id: 'month', label: 'شهر' },
] as const;

export default function SettlementPage() {
  const { tenantId } = useAdminContext();
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('month');

  const { data, isLoading } = useQuery<MerchantSummary>({
    queryKey: ['merchant-settlement', tenantId, preset],
    queryFn: () => api.getTenantSettlementSummary(tenantId!, preset),
    enabled: !!tenantId && USE_API,
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['merchant-settlement-ledger', tenantId, preset],
    queryFn: () => api.getTenantSettlementLedger(tenantId!, preset),
    enabled: !!tenantId && USE_API,
  });

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4" dir="rtl">
      <h1 className="text-lg font-bold text-gray-900">تسوية Now Market</h1>
      <p className="text-sm text-gray-500">عمولة طلبات الاستلام من المتجر (نقداً) — وليس طلبات التوصيل.</p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            variant={preset === p.id ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        {isLoading ? (
          <p className="text-gray-500">جاري التحميل...</p>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">المبلغ المطلوب دفعه لـ Now Market</span>
              <span className="font-bold text-primary tabular-nums">
                {formatPrice(data?.pickupCommissionOwed ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">المدفوعات المسجلة</span>
              <span className="tabular-nums">{formatPrice(data?.paymentsMade ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t font-semibold">
              <span>المتبقي</span>
              <span className="text-primary tabular-nums">{formatPrice(data?.remainingBalance ?? 0)}</span>
            </div>
          </>
        )}
      </Card>

      {ledger.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">حركات الفترة</h2>
          <ul className="space-y-2 text-sm">
            {ledger.slice(0, 20).map((e: { entryType: string; amount: number }, i: number) => (
              <li key={i} className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">{e.entryType}</span>
                <span className="tabular-nums">{formatPrice(e.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
