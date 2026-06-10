import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, Input } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { formatDateGregorian } from '@nmd/core';
import { Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../api';
import { matchesCustomerSearch, sortCustomersByRegisteredDesc } from '../lib/participantListUtils';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

type CustomerRow = {
  id: string;
  name?: string;
  phone: string;
  email?: string;
  createdAt?: string;
  lastActivityAt?: string;
};

function formatCustomerDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return formatDateGregorian(iso);
  } catch {
    return iso;
  }
}

export default function CustomersPage() {
  const { user: me } = useAuth();
  const [grantPhone, setGrantPhone] = useState('');
  const [grantAmount, setGrantAmount] = useState(20);
  const [customerSearch, setCustomerSearch] = useState('');
  const isPlatformAdmin = me?.role === 'ROOT_ADMIN' || me?.role === 'SUPER_ADMIN';

  const grantCoinsMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ balance: number; granted: number }>('/admin/customers/grant-coins', {
        method: 'POST',
        body: JSON.stringify({
          phone: grantPhone.trim(),
          amount: grantAmount,
        }),
      }),
  });
  const [searchParams] = useSearchParams();
  const urlTenant = searchParams.get('tenant')?.trim() || undefined;
  const effectiveTenantSlug = urlTenant ?? (me?.role === 'TENANT_ADMIN' ? (me as { tenantSlug?: string })?.tenantSlug : undefined);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', effectiveTenantSlug ?? ''],
    queryFn: () => api.listCustomers(effectiveTenantSlug),
    enabled: !!MOCK_API_URL,
  });

  const visibleCustomers = useMemo(() => {
    const filtered = (customers as CustomerRow[]).filter((c) =>
      matchesCustomerSearch(customerSearch, {
        name: c.name,
        phone: c.phone,
        email: c.email,
      }),
    );
    return sortCustomersByRegisteredDesc(filtered);
  }, [customers, customerSearch]);

  const isTenantAdmin = (me as { role?: string })?.role === 'TENANT_ADMIN';
  const subtitle = effectiveTenantSlug
    ? `المشتركون لمتجر واحد فقط (${effectiveTenantSlug})`
    : isTenantAdmin
      ? 'العملاء الذين تواصلوا معك أو طلبوا من متجرك'
      : (me as { role?: string })?.role === 'MARKET_ADMIN'
        ? 'المشتركون في سوقك'
        : 'جميع المشتركين المسجلين في المنصة';

  if (!MOCK_API_URL) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">المشتركون</h1>
        <Card className="p-6">
          <p className="text-sm text-amber-600">يتطلب mock-api (VITE_MOCK_API_URL)</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">المشتركون</h1>
      {MOCK_API_URL && isPlatformAdmin && (
        <Card className="p-4 mb-6 bg-teal-50 border border-teal-100">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">منح عملات مكافآت (يدوي)</h2>
          <p className="text-xs text-gray-600 mb-3">يضيف عملات NMD إلى محفظة العميل حسب رقم الجوال (سوبر أدمن فقط).</p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">الجوال</span>
              <input
                className="border rounded px-2 py-1.5 text-sm dir-ltr min-w-[180px]"
                value={grantPhone}
                onChange={(e) => setGrantPhone(e.target.value)}
                placeholder="9725..."
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">الكمية</span>
              <input
                type="number"
                min={1}
                className="border rounded px-2 py-1.5 text-sm w-24"
                value={grantAmount}
                onChange={(e) => setGrantAmount(Number(e.target.value) || 0)}
              />
            </label>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
              disabled={grantCoinsMutation.isPending || !grantPhone.trim()}
              onClick={() => grantCoinsMutation.mutate()}
            >
              {grantCoinsMutation.isPending ? 'جاري المنح...' : 'منح العملات'}
            </button>
          </div>
          {grantCoinsMutation.isSuccess && (
            <p className="text-sm text-green-700 mt-2">
              تم المنح. الرصيد الجديد: {grantCoinsMutation.data.balance} (تمت إضافة {grantCoinsMutation.data.granted})
            </p>
          )}
          {grantCoinsMutation.isError && (
            <p className="text-sm text-red-600 mt-2">
              {grantCoinsMutation.error instanceof Error ? grantCoinsMutation.error.message : 'فشل المنح'}
            </p>
          )}
        </Card>
      )}
      {effectiveTenantSlug && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          عرض بيانات متجر واحد فقط: <strong>{effectiveTenantSlug}</strong>
        </p>
      )}
      <p className="text-sm text-gray-600 mb-4">{subtitle}</p>
      <div className="relative max-w-md mb-4">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          placeholder="ابحث حسب الاسم أو رقم الهاتف"
          className="ps-10"
        />
      </div>
      <Card className="p-4">
        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">جاري التحميل...</p>
        ) : customers.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">لا يوجد مشتركون مسجلون</p>
        ) : visibleCustomers.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">لا يوجد مشتركون مطابقون للبحث</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الاسم</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">رقم الجوال</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">البريد</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">التسجيل</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">آخر نشاط</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">{c.name ?? '—'}</td>
                    <td className="px-4 py-3" dir="ltr">
                      <a href={`tel:${c.phone}`} className="text-primary hover:underline">
                        {c.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">
                      {c.email?.trim() ? c.email : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatCustomerDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatCustomerDate(c.lastActivityAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
