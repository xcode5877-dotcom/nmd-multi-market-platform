import { useMemo, useState } from 'react';
import { formatPrice } from '@nmd/core';
import {
  computePlatformFeePreview,
  type PlatformFeeConfig,
  type TenantPlatformFeeOverride,
} from '../../lib/platform-fee';

type Props = {
  marketFeeConfig?: PlatformFeeConfig | null;
  tenantFeeOverride?: TenantPlatformFeeOverride | null;
  title?: string;
};

export default function PlatformFeePreviewCalculator({
  marketFeeConfig,
  tenantFeeOverride,
  title = 'معاينة الحساب',
}: Props) {
  const [itemsSubtotal, setItemsSubtotal] = useState(100);
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(15);
  const [itemCount, setItemCount] = useState(3);

  const result = useMemo(
    () =>
      computePlatformFeePreview({
        itemsSubtotal,
        discountAmount: discount,
        itemCount,
        deliveryFee,
        marketFeeConfig,
        tenantFeeOverride,
        simulateOrdersEnabled: true,
      }),
    [itemsSubtotal, discount, itemCount, deliveryFee, marketFeeConfig, tenantFeeOverride]
  );

  const sourceLabel =
    result.appliedConfigSource === 'MARKET'
      ? 'إعداد السوق'
      : result.appliedConfigSource === 'TENANT'
        ? 'إعداد المتجر'
        : 'معطّل';

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">معاينة فقط — لا يتم إنشاء طلبات</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">مجموع المنتجات</span>
          <input
            type="number"
            min={0}
            step={1}
            value={itemsSubtotal}
            onChange={(e) => setItemsSubtotal(Number(e.target.value) || 0)}
            className="w-full h-9 px-2 rounded border border-gray-300 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">خصم</span>
          <input
            type="number"
            min={0}
            step={1}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className="w-full h-9 px-2 rounded border border-gray-300 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">رسوم التوصيل</span>
          <input
            type="number"
            min={0}
            step={1}
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
            className="w-full h-9 px-2 rounded border border-gray-300 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">عدد القطع</span>
          <input
            type="number"
            min={0}
            step={1}
            value={itemCount}
            onChange={(e) => setItemCount(Number(e.target.value) || 0)}
            className="w-full h-9 px-2 rounded border border-gray-300 text-sm"
          />
        </label>
      </div>

      <div className="text-sm space-y-1.5 border-t border-slate-200 pt-3">
        <Row label="أساس الرسوم (بعد الخصم)" value={formatPrice(result.feeBase)} />
        <Row label="رسوم المنصة" value={formatPrice(result.platformFee)} highlight />
        <Row label="حصة التاجر (لا تشمل رسوم المنصة)" value={formatPrice(result.merchantPayout)} />
        <Row label="إجمالي الزبون" value={formatPrice(result.customerTotal)} strong />
        <p className="text-xs text-gray-500 pt-1">المصدر: {sourceLabel}</p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  strong,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-600">{label}</span>
      <span className={strong ? 'font-bold text-primary' : highlight ? 'font-semibold text-teal-700' : 'font-medium tabular-nums'}>
        {value}
      </span>
    </div>
  );
}
