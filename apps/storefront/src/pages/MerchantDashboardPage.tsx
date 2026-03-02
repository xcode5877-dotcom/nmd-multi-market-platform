import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, Store, LogOut, MessageCircle } from 'lucide-react';
import { Button } from '@nmd/ui';
import { useMerchantAuth } from '../contexts/MerchantAuthContext';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface DashboardData {
  totalVisitors: number;
  recentLogins: Array<{ name: string; phone: string; lastVisit: string }>;
}

interface LeadRow {
  id: string;
  tenantId: string;
  type: string;
  timestamp?: string;
  contactType?: string;
  metadata?: Record<string, unknown>;
}

function formatDate(s?: string): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

export default function MerchantDashboardPage() {
  const { isMerchant, merchantTenantId, loginAsMerchant, logoutMerchant } = useMerchantAuth();
  const tenantSlug = merchantTenantId ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-dashboard', merchantTenantId, MOCK_API_URL],
    queryFn: async (): Promise<DashboardData> => {
      if (MOCK_API_URL) {
        const slug = tenantSlug || 'buffalo';
        const url = `${MOCK_API_URL}/merchant/dashboard?tenantSlug=${encodeURIComponent(slug)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      }
      return {
        totalVisitors: 42,
        recentLogins: [
          { name: 'أحمد محمد', phone: '0501234567', lastVisit: new Date(Date.now() - 3600000).toISOString() },
          { name: 'سارة علي', phone: '0529876543', lastVisit: new Date(Date.now() - 7200000).toISOString() },
          { name: 'محمد خالد', phone: '0541112233', lastVisit: new Date(Date.now() - 86400000).toISOString() },
        ],
      };
    },
    enabled: isMerchant && !!merchantTenantId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['merchant-leads', tenantSlug, MOCK_API_URL],
    queryFn: async (): Promise<LeadRow[]> => {
      if (!MOCK_API_URL || !tenantSlug) return [];
      const url = `${MOCK_API_URL}/merchant/leads?tenantSlug=${encodeURIComponent(tenantSlug)}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isMerchant && !!tenantSlug && !!MOCK_API_URL,
  });

  if (!isMerchant) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center" dir="rtl">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">لوحة التاجر</h1>
        <p className="text-gray-600 mb-6">يجب أن تكون مسجلاً كتاجر للوصول إلى هذه الصفحة</p>
        <div className="flex flex-col gap-3 items-center">
          <Button onClick={() => loginAsMerchant('buffalo')}>عرض تجريبي: تسجيل كتاجر (Buffalo)</Button>
          <Button variant="outline" onClick={() => loginAsMerchant('lawyer-falan')}>عرض تجريبي: محامي نمر (Lawyer)</Button>
          <Link to="/" className="text-[#D97706] font-medium hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            العودة للأسواق
          </Link>
        </div>
      </div>
    );
  }

  const totalVisitors = data?.totalVisitors ?? 0;
  const recentLogins = data?.recentLogins ?? [];

  return (
    <div className="max-w-2xl mx-auto p-4 pt-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">لوحة التاجر</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={logoutMerchant} className="flex items-center gap-1">
            <LogOut className="w-4 h-4" />
            خروج
          </Button>
          <Link to="/" className="flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            الأسواق
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-[#D97706]" />
              <h2 className="text-lg font-semibold text-gray-900">إجمالي الزوار</h2>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalVisitors}</p>
            <p className="text-sm text-gray-500 mt-1">عملاء تفاعلوا مع المحل (طلبات أو تواصل)</p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <Store className="w-5 h-5 text-[#D97706]" />
              <h2 className="font-semibold text-gray-900">آخر تسجيلات الدخول</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentLogins.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">لا يوجد زوار مسجلون بعد</div>
              ) : (
                recentLogins.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-sm text-gray-500">{c.phone}</p>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(c.lastVisit)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#D97706]" />
              <h2 className="font-semibold text-gray-900">آخر الاستفسارات / الطلبات المهنية</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {leads.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">لا توجد استفسارات أو طلبات تواصل حتى الآن</div>
              ) : (
                leads.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {l.type === 'PROFESSIONAL_CONTACT' ? (l.contactType === 'call' ? 'اتصال هاتفي' : 'واتساب') : l.type}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(l.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
