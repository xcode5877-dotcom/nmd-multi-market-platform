import { useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Button, useToast } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import { Package, MessageCircle, ArrowLeft, Store, Clock, Bell, Gift, Copy } from 'lucide-react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { useAppStore } from '../store/app';
import { usePushNotifications } from '../hooks/usePushNotifications';

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


export default function MyActivityPage() {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const { pathname } = useLocation();
  const { customer, isLoading: authLoading } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const tenantSlugOrId = useAppStore((s) => s.tenantSlug) ?? tenantSlug;
  const isMarketLevel = pathname === '/my-activity';
  const { isSupported, permission, isSubscribed, error, requestAndSubscribe } = usePushNotifications();
  const [notifLoading, setNotifLoading] = useState(false);
  const addToast = useToast().addToast;

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['customer-activity'],
    queryFn: () => api.getCustomerActivity(),
    enabled: !!customer,
  });
  const { data: rewards = [] } = useQuery({
    queryKey: ['customer-rewards'],
    queryFn: () => api.getCustomerRewards(),
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

  interface OrderActivityItem {
    id?: string;
    status?: string;
    total?: number;
    currency?: string;
    createdAt?: string;
    tenantName?: string;
    tenantSlug?: string;
    orderGroupId?: string;
  }
  const orders = (activity?.orders ?? []) as OrderActivityItem[];
  const leads = (activity?.leads ?? []) as Array<{
    id?: string;
    tenantId?: string;
    tenantName?: string;
    tenantSlug?: string;
    contactType?: string;
    timestamp?: string;
  }>;

  const ordersWithGroup = orders.filter((o) => o.orderGroupId);
  const ordersWithoutGroup = orders.filter((o) => !o.orderGroupId);
  const orderGroupsMap = new Map<string, OrderActivityItem[]>();
  ordersWithGroup.forEach((o) => {
    const gid = o.orderGroupId ?? '';
    if (!gid) return;
    if (!orderGroupsMap.has(gid)) orderGroupsMap.set(gid, []);
    orderGroupsMap.get(gid)!.push(o);
  });
  const orderGroups = Array.from(orderGroupsMap.values()).sort(
    (a, b) => new Date((b[0]?.createdAt ?? 0) as string).getTime() - new Date((a[0]?.createdAt ?? 0) as string).getTime()
  );

  type StoreKey = string;
  const storeOrders = new Map<StoreKey, OrderActivityItem[]>();
  const storeLeads = new Map<StoreKey, typeof leads>();
  ordersWithoutGroup.forEach((o) => {
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

      {isSupported && (
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-6" aria-labelledby="notifications-heading">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 id="notifications-heading" className="font-semibold text-gray-900">التنبيهات</h2>
          </div>
          <div className="p-4">
            {permission === 'granted' && isSubscribed ? (
              <p className="text-sm text-gray-600">تم تفعيل التنبيهات. ستصل إشعارات الطلبات والعروض إلى جهازك حتى لو كان التطبيق مغلقاً.</p>
            ) : permission === 'denied' ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">التنبيهات معطّلة حالياً. لتفعيلها:</p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li>في المتصفح: الإعدادات → التطبيقات → هذا الموقع → الإشعارات ← فعّل</li>
                  <li>أو من إعدادات الهاتف: التطبيقات → ابحث عن الموقع → الإشعارات ← فعّل</li>
                </ul>
                <p className="text-sm text-gray-500">بعد التفعيل، ارجع إلى هذه الصفحة واضغط &quot;تفعيل التنبيهات&quot; مرة أخرى.</p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setNotifLoading(true);
                    await requestAndSubscribe(customer?.phone ?? '');
                    setNotifLoading(false);
                  }}
                >
                  حاول مرة أخرى
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-700 mb-2">لماذا تفعيل التنبيهات؟</p>
                <ul className="text-sm text-gray-600 list-disc list-inside mb-4 space-y-0.5">
                  <li>إشعارك عند تأكيد الطلب (قيد التجهيز)</li>
                  <li>إشعارك عندما يصبح الطلب جاهزاً أو في الطريق إليك</li>
                  <li>يعمل حتى عندما يكون التطبيق مغلقاً</li>
                </ul>
                <Button
                  disabled={notifLoading}
                  onClick={async () => {
                    setNotifLoading(true);
                    await requestAndSubscribe(customer?.phone ?? '');
                    setNotifLoading(false);
                  }}
                >
                  {notifLoading ? 'جاري التفعيل...' : 'تفعيل التنبيهات'}
                </Button>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              </>
            )}
          </div>
        </section>
      )}

      {/* My Rewards (جوائزي) */}
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-6" aria-labelledby="rewards-heading">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          <h2 id="rewards-heading" className="font-semibold text-gray-900">جوائزي</h2>
        </div>
        <div className="p-4">
          {rewards.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد أكواد خصم نشطة حالياً</p>
          ) : (
            <ul className="space-y-2">
              {rewards.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-amber-50 border border-amber-200"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-amber-900" dir="ltr">{r.code}</span>
                    <span className="text-xs text-amber-700 ms-2">
                      {r.type === 'PERCENT' ? `${r.value}%` : formatPrice(r.value)}
                    </span>
                    {r.expiresAt && (
                      <span className="block text-xs text-amber-600 mt-0.5">
                        صالح حتى {new Date(r.expiresAt).toLocaleDateString('ar-EG')}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(r.code);
                      addToast('تم النسخ', 'success');
                    }}
                    className="shrink-0 flex items-center gap-1"
                  >
                    <Copy className="w-4 h-4" />
                    نسخ
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

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
                      {a.createdAt && <p className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleString()}</p>}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {orderGroups.length > 0 ? (
            <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">طلبات من عدة متاجر (مجموعة واحدة)</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {orderGroups.map((group, gi) => {
                  const storeNames = [...new Set(group.map((o: OrderActivityItem) => String(o.tenantName ?? o.tenantSlug ?? 'متجر')))];
                  const summaryLabel = storeNames.length > 0 ? `طلب من: ${storeNames.join(' و ')}` : 'طلب من عدة متاجر';
                  const statusLabels: Record<string, string> = {
                    PENDING: 'قيد الانتظار',
                    CONFIRMED: 'مؤكد',
                    PREPARING: 'قيد التحضير',
                    READY: 'جاهز للاستلام',
                    OUT_FOR_DELIVERY: 'خرج للتوصيل',
                    DELIVERED: 'تم التسليم',
                    COMPLETED: 'مكتمل',
                    CANCELLED: 'ملغي',
                    CANCELED: 'ملغي',
                  };
                  const statusLine = group
                    .map((o) => {
                      const name = String(o.tenantName ?? o.tenantSlug ?? 'متجر');
                      const status = o.status ?? '—';
                      const label = statusLabels[status] ?? status;
                      return `[${name}: ${label}]`;
                    })
                    .join(' | ');
                  return (
                    <div key={gi} className="p-4">
                      <p className="text-sm font-semibold text-gray-800 mb-1">{summaryLabel}</p>
                      <p className="text-xs text-gray-600 mb-3" aria-label="حالة كل متجر">{statusLine}</p>
                      {group.map((o, oi) => {
                        const storeName = String(o.tenantName ?? o.tenantSlug ?? 'متجر');
                        return (
                          <Link
                            key={o.id ?? `g-${gi}-${oi}`}
                            to={o.tenantSlug ? `/${o.tenantSlug}/order/${o.id}/success` : `/order/${o.id}/success`}
                            className="flex items-center justify-between gap-4 py-2.5 px-3 -mx-3 rounded-lg hover:bg-gray-50 transition-colors border-r-2 border-transparent hover:border-primary/30"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Package className="w-4 h-4 text-primary flex-shrink-0" />
                              <div>
                                <p className="font-medium text-gray-900">
                                  <span className="text-primary/90">{storeName}</span> — {formatPrice(o.total ?? 0)}
                                </p>
                                <p className="text-xs text-gray-500">{o.createdAt ? new Date(o.createdAt).toLocaleString('ar-EG') : '—'}</p>
                              </div>
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                                o.status === 'DELIVERED' || o.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : o.status === 'CANCELLED' || o.status === 'CANCELED'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {o.status ?? '—'}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {ordersWithoutGroup.length > 0 ? (
            <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">طلبات فردية</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {ordersWithoutGroup.map((o, oi) => {
                  const storeName = String(o.tenantName ?? o.tenantSlug ?? 'متجر');
                  return (
                    <Link
                      key={o.id ?? `s-${oi}`}
                      to={o.tenantSlug ? `/${o.tenantSlug}/order/${o.id}/success` : `/order/${o.id}/success`}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">
                            <span className="text-primary/90">{storeName}</span> — {formatPrice(o.total ?? 0)}
                          </p>
                          <p className="text-xs text-gray-500">{o.createdAt ? new Date(o.createdAt).toLocaleString('ar-EG') : '—'}</p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                          o.status === 'DELIVERED' || o.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.status === 'CANCELLED' || o.status === 'CANCELED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {o.status ?? '—'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

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
                      {storeOrdersList.map((o, oi) => (
                        <Link
                          key={o.id ?? `d-${storeName}-${oi}`}
                          to={o.tenantSlug ? `/${o.tenantSlug}/order/${o.id}/success` : `/order/${o.id}/success`}
                          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Package className="w-4 h-4 text-primary flex-shrink-0" />
                            <div>
                              <p className="font-medium text-gray-900">
                                <span className="text-primary/90">{o.tenantName ?? o.tenantSlug ?? storeName}</span> — {formatPrice(o.total ?? 0)}
                              </p>
                              <p className="text-xs text-gray-500">{o.createdAt ? new Date(o.createdAt).toLocaleString('ar-EG') : '—'}</p>
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                              o.status === 'DELIVERED' || o.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.status === 'CANCELLED' || o.status === 'CANCELED'
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
                            <p className="text-xs text-gray-500">{l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}</p>
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
