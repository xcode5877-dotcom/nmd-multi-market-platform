import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Button } from '@nmd/ui';
import { Package, MessageCircle, ArrowLeft, Store, Clock } from 'lucide-react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { useAppStore } from '../store/app';

const api = new MockApiClient();

/** Mock recent actions for demo. In production, derive from activity API. */
function getMockRecentActions(orders: Array<{ tenantName?: string; tenantSlug?: string; createdAt?: string }>, leads: Array<{ tenantName?: string; tenantSlug?: string; timestamp?: string }>): Array<{ id: string; label: string; type: 'visit' | 'order'; storeName: string; storeSlug?: string; createdAt: string }> {
  const actions: Array<{ id: string; label: string; type: 'visit' | 'order'; storeName: string; storeSlug?: string; createdAt: string }> = [];
  orders.slice(0, 5).forEach((o, i) => {
    const name = o.tenantName ?? o.tenantSlug ?? 'متجر';
    actions.push({ id: `order-${o.tenantSlug ?? i}`, label: `طلب من ${name}`, type: 'order', storeName: name, storeSlug: o.tenantSlug, createdAt: o.createdAt ?? '' });
  });
  leads.slice(0, 5).forEach((l, i) => {
    const name = l.tenantName ?? l.tenantSlug ?? 'محترف';
    actions.push({ id: `lead-${l.tenantSlug ?? i}`, label: `زيارة آخر مرة لـ ${name}`, type: 'visit', storeName: name, storeSlug: l.tenantSlug, createdAt: l.timestamp ?? '' });
  });
  actions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (actions.length === 0) {
    actions.push({ id: 'mock-1', label: 'زيارة آخر مرة لـ محامي نمر', type: 'visit', storeName: 'محامي نمر', storeSlug: 'lawyer-nimer', createdAt: new Date(Date.now() - 86400000).toISOString() });
    actions.push({ id: 'mock-2', label: 'طلب من Buffalo', type: 'order', storeName: 'Buffalo', storeSlug: 'buffalo', createdAt: new Date(Date.now() - 172800000).toISOString() });
  }
  return actions.slice(0, 8);
}

function formatPrice(n: number, currency = 'ILS'): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency }).format(n);
}

function formatDate(s?: string): string {
  if (!s) return '';
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

export default function MyActivityPage() {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const { pathname } = useLocation();
  const { customer, isLoading: authLoading } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const tenantSlugOrId = useAppStore((s) => s.tenantSlug) ?? tenantSlug;
  const isMarketLevel = pathname === '/my-activity';

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['customer-activity'],
    queryFn: () => api.getCustomerActivity(),
    enabled: !!customer,
  });

  if (authLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center" dir="rtl">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">نشاطي</h1>
        <p className="text-gray-600 mb-6">سجّل الدخول لعرض طلباتك وتواصلك مع المحترفين</p>
        <Button onClick={() => openAuthModal()}>تسجيل الدخول</Button>
      </div>
    );
  }

  const orders = (activity?.orders ?? []) as Array<{
    id?: string;
    status?: string;
    total?: number;
    currency?: string;
    createdAt?: string;
    tenantName?: string;
    tenantSlug?: string;
  }>;
  const leads = (activity?.leads ?? []) as Array<{
    id?: string;
    tenantId?: string;
    tenantName?: string;
    tenantSlug?: string;
    contactType?: string;
    timestamp?: string;
  }>;

  type StoreKey = string;
  const storeOrders = new Map<StoreKey, typeof orders>();
  const storeLeads = new Map<StoreKey, typeof leads>();
  orders.forEach((o) => {
    const key = o.tenantName ?? o.tenantSlug ?? 'متجر';
    if (!storeOrders.has(key)) storeOrders.set(key, []);
    storeOrders.get(key)!.push(o);
  });
  leads.forEach((l) => {
    const key = l.tenantName ?? l.tenantSlug ?? 'محترف';
    if (!storeLeads.has(key)) storeLeads.set(key, []);
    storeLeads.get(key)!.push(l);
  });
  const allStoreNames = new Set([...storeOrders.keys(), ...storeLeads.keys()]);
  const sortedStores = Array.from(allStoreNames).sort((a, b) => a.localeCompare(b, 'ar'));
  const recentActions = getMockRecentActions(orders, leads);

  return (
    <div className="max-w-2xl mx-auto p-4 pt-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">نشاطي</h1>
        <Link
          to={isMarketLevel ? '/' : (tenantSlugOrId ? `/${tenantSlugOrId}` : '/')}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          العودة
        </Link>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        مرحباً، {customer.name || customer.phone}
      </p>

      {activityLoading ? (
        <div className="space-y-6">
          <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : (
        <div className="space-y-8">
          {sortedStores.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-gray-900">محلاتي</h2>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {sortedStores.map((storeName) => {
                    const slug = (orders.find((o) => (o.tenantName ?? o.tenantSlug) === storeName)?.tenantSlug ?? leads.find((l) => (l.tenantName ?? l.tenantSlug) === storeName)?.tenantSlug) ?? storeName;
                    return (
                      <Link
                        key={storeName}
                        to={slug ? `/${slug}` : '#'}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors text-sm font-medium"
                      >
                        <Store className="w-4 h-4" />
                        {storeName}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-gray-900">آخر الإجراءات</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentActions.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">لا توجد إجراءات حديثة</div>
              ) : (
                recentActions.map((a) => (
                  <Link
                    key={a.id}
                    to={a.storeSlug ? `/${a.storeSlug}` : '#'}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    {a.type === 'order' ? (
                      <Package className="w-4 h-4 text-primary flex-shrink-0" />
                    ) : (
                      <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{a.label}</p>
                      {a.createdAt && <p className="text-xs text-gray-500">{formatDate(a.createdAt)}</p>}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {orders.length > 0 || leads.length > 0 ? (
            <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">التفاصيل</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {sortedStores.map((storeName) => {
                  const storeOrdersList = storeOrders.get(storeName) ?? [];
                  const storeLeadsList = storeLeads.get(storeName) ?? [];
                  if (storeOrdersList.length === 0 && storeLeadsList.length === 0) return null;
                  return (
                    <div key={storeName}>
                      <div className="px-4 py-2 bg-gray-50/50 text-sm font-medium text-gray-700">{storeName}</div>
                      {storeOrdersList.map((o) => (
                        <Link
                          key={o.id}
                          to={o.tenantSlug ? `/${o.tenantSlug}/order/${o.id}/success` : `/order/${o.id}/success`}
                          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Package className="w-4 h-4 text-primary flex-shrink-0" />
                            <div>
                              <p className="font-medium text-gray-900">طلب — {formatPrice((o.total ?? 0), o.currency)}</p>
                              <p className="text-xs text-gray-500">{formatDate(o.createdAt)}</p>
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                              o.status === 'DELIVERED' || o.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.status === 'CANCELED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {o.status ?? '—'}
                          </span>
                        </Link>
                      ))}
                      {storeLeadsList.map((l) => (
                        <div key={l.id} className="flex items-center gap-2 px-4 py-3">
                          <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {l.contactType === 'whatsapp' ? 'واتساب' : l.contactType === 'call' ? 'اتصال هاتفي' : l.contactType}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(l.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="p-8 rounded-xl border border-gray-200 bg-gray-50 text-center text-gray-500">
              <p className="mb-2">لا توجد طلبات أو تواصل حتى الآن</p>
              <p className="text-sm">طلباتك وتواصلك مع المحترفين ستظهر هنا</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
