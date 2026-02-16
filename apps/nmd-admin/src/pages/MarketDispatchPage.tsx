import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Modal, useToast, Tabs, TabsList, TabsTrigger, TabsContent, Input, Select, Skeleton } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { buildWhatsAppUrl, buildWhatsAppMessage } from '@nmd/core';
import { ArrowLeft, Copy, Phone, Search, Package, UserCheck, CheckCircle, MessageCircle, Users } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useEmergencyMode } from '../contexts/EmergencyModeContext';
import type { MarketCourier, MarketCourierWithStats } from '@nmd/mock';
import type { Order, Tenant } from '@nmd/core';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

type OrderRow = {
  id?: string;
  tenantId?: string;
  status?: string;
  readyAt?: string;
  fulfillmentType?: string;
  deliveryAssignmentMode?: string;
  courierId?: string;
  deliveryStatus?: string;
  customerName?: string;
  customerPhone?: string;
  deliveredAt?: string;
  createdAt?: string;
  delivery?: { method?: string; zoneName?: string; fee?: number; addressText?: string };
  deliveryAddress?: string;
  items?: { productName?: string; quantity?: number; totalPrice?: number; selectedOptions?: unknown[]; optionGroups?: unknown[] }[];
  total?: number;
  notes?: string;
  deliveryTimeline?: {
    assignedAt?: string;
    acknowledgedAt?: string;
    pickedUpAt?: string;
    deliveredAt?: string;
    closedAt?: string;
    durations?: { totalMinutes?: number; assignedToAcknowledged?: number; acknowledgedToPickedUp?: number; pickedUpToDelivered?: number };
  };
};

/** SLA thresholds (minutes): < 30 green, 30–45 amber, > 45 red */
const SLA_OK = 30;
const SLA_WARN = 45;

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  UNASSIGNED: 'غير معيّن',
  ASSIGNED: 'معيّن',
  PICKED_UP: 'تم الاستلام',
  OUT_FOR_DELIVERY: 'خارج للتوصيل',
  DELIVERED: 'تم التسليم',
};

const DELIVERY_STATUS_CLASSES: Record<string, string> = {
  UNASSIGNED: 'bg-gray-100 text-gray-700',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  PICKED_UP: 'bg-amber-100 text-amber-800',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
};

function DurationAndSla({ order }: { order: OrderRow }) {
  const dur = order.deliveryTimeline?.durations;
  const totalMin = dur?.totalMinutes;
  if (totalMin == null) return <span className="text-gray-400 text-xs">—</span>;
  const slaClass =
    totalMin < SLA_OK ? 'bg-green-100 text-green-800' :
    totalMin <= SLA_WARN ? 'bg-amber-100 text-amber-800' :
    'bg-red-100 text-red-800';
  const slaLabel = totalMin < SLA_OK ? 'ضمن SLA' : totalMin <= SLA_WARN ? 'تحذير' : 'تجاوز';
  const parts: string[] = [`${totalMin} د`];
  if (dur?.assignedToAcknowledged != null) parts.push(`بدء:${dur.assignedToAcknowledged}`);
  if (dur?.acknowledgedToPickedUp != null) parts.push(`استلام:${dur.acknowledgedToPickedUp}`);
  if (dur?.pickedUpToDelivered != null) parts.push(`توصيل:${dur.pickedUpToDelivered}`);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium">{parts.join(' · ')}</span>
      <span className={`inline-flex w-fit px-2 py-0.5 rounded text-xs font-medium ${slaClass}`}>{slaLabel}</span>
    </div>
  );
}

export default function MarketDispatchPage() {
  const { id: marketId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const emergencyMode = useEmergencyMode();
  const [createJobModalOpen, setCreateJobModalOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [assignJobId, setAssignJobId] = useState<string | null>(null);
  const [addCourierModalOpen, setAddCourierModalOpen] = useState(false);
  const [editCourierModalOpen, setEditCourierModalOpen] = useState<MarketCourier | null>(null);
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierPhone, setNewCourierPhone] = useState('');
  const [editCourierName, setEditCourierName] = useState('');
  const [editCourierPhone, setEditCourierPhone] = useState('');
  const [activeTab, setActiveTab] = useState('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTenant, setFilterTenant] = useState<string>('');
  const [filterCourier, setFilterCourier] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [courierFilterActive, setCourierFilterActive] = useState<string>('');
  const [courierFilterAvailable, setCourierFilterAvailable] = useState<string>('');
  const [statsFilterActive, setStatsFilterActive] = useState<string>('');
  const [statsFilterAvailable, setStatsFilterAvailable] = useState<string>('');
  const [statsSortBy, setStatsSortBy] = useState<string>('deliveredCountWeek');
  const [statsSortDir, setStatsSortDir] = useState<'asc' | 'desc'>('desc');
  const [whatsAppModal, setWhatsAppModal] = useState<{
    order: OrderRow;
    tenant: { id: string; name: string };
    recipient: 'customer' | 'courier';
    phone: string;
    name: string;
    initialMessage: string;
  } | null>(null);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL,
  });
  const isRootAdmin = me?.role === 'ROOT_ADMIN';
  const canWrite = !isRootAdmin || (isRootAdmin && !!emergencyMode?.enabled);

  const { data: market } = useQuery({
    queryKey: ['market', marketId],
    queryFn: () => fetch(`${MOCK_API_URL}/markets/${marketId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('nmd-access-token')}` } }).then((r) => r.json()),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: allMarketOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['market-orders', marketId],
    queryFn: () => api.getMarketOrders(marketId!),
    enabled: !!marketId && !!MOCK_API_URL,
    refetchInterval: 8000,
  });

  const allDeliveryOrders = (allMarketOrders as OrderRow[]).filter(
    (o) => o.fulfillmentType === 'DELIVERY' && o.status !== 'CANCELED'
  );

  const { data: queue = [] } = useQuery({
    queryKey: ['dispatch-queue', marketId],
    queryFn: () => api.getDispatchQueue(marketId!),
    enabled: !!marketId && !!MOCK_API_URL,
    refetchInterval: 8000,
  });

  const { data: couriers = [] } = useQuery({
    queryKey: ['market-couriers', marketId],
    queryFn: () => api.getMarketCouriers(marketId!),
    enabled: !!marketId && !!MOCK_API_URL,
    refetchInterval: 8000,
  });

  const { data: courierStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['market-courier-stats', marketId],
    queryFn: () => api.getMarketCourierStats(marketId!),
    enabled: !!marketId && !!MOCK_API_URL,
    refetchInterval: 8000,
  });

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['market-leaderboard', marketId],
    queryFn: () => api.getMarketLeaderboard(marketId!, 'week'),
    enabled: !!marketId && !!MOCK_API_URL,
    refetchInterval: 8000,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['delivery-jobs', marketId],
    queryFn: () => api.getDeliveryJobs(marketId!),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
    enabled: !!marketId,
  });

  const tenantMap = useMemo(
    () => new Map((tenants as { id: string; name: string }[]).map((t) => [t.id, t.name])),
    [tenants]
  );

  const couriersList = couriers as MarketCourier[];
  const availableCouriersCount = couriersList.filter((c) => c.isActive && c.isAvailable !== false).length;
  const availableCouriers = couriersList.filter((c) => c.isActive && c.isAvailable !== false);
  const queueOrders = useMemo(() => allDeliveryOrders.filter((o) => !o.courierId), [allDeliveryOrders]);
  const assignedOrders = useMemo(
    () => allDeliveryOrders.filter((o) => o.courierId && o.status !== 'OUT_FOR_DELIVERY' && o.status !== 'DELIVERED'),
    [allDeliveryOrders]
  );
  const deliveredCount = useMemo(
    () => allDeliveryOrders.filter((o) => o.status === 'DELIVERED').length,
    [allDeliveryOrders]
  );

  const dashboardStats = useMemo(
    () => ({
      queue: queueOrders.length,
      assigned: assignedOrders.length,
      delivered: deliveredCount,
      availableCouriers: availableCouriersCount,
    }),
    [queueOrders.length, assignedOrders.length, deliveredCount, availableCouriersCount]
  );

  const baseFilter = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (o: OrderRow) => {
      if (q) {
        const id = (o.id ?? '').toLowerCase();
        const cust = (o.customerName ?? '').toLowerCase();
        const tenantName = (tenantMap.get(o.tenantId ?? '') ?? '').toLowerCase();
        if (!id.includes(q) && !cust.includes(q) && !tenantName.includes(q)) return false;
      }
      if (filterTenant && o.tenantId !== filterTenant) return false;
      if (filterCourier && o.courierId !== filterCourier) return false;
      if (filterStatus) {
        if (filterStatus === 'UNASSIGNED' && o.courierId) return false;
        if (filterStatus === 'ASSIGNED' && (!o.courierId || o.status === 'OUT_FOR_DELIVERY' || o.status === 'DELIVERED')) return false;
        if (filterStatus === 'PICKED_UP' && o.status !== 'OUT_FOR_DELIVERY') return false;
        if (filterStatus === 'DELIVERED' && o.status !== 'DELIVERED') return false;
      }
      return true;
    };
  }, [searchQuery, filterTenant, filterCourier, filterStatus, tenantMap]);

  const queueFiltered = useMemo(() => queueOrders.filter(baseFilter), [queueOrders, baseFilter]);
  const assignedFiltered = useMemo(() => assignedOrders.filter(baseFilter), [assignedOrders, baseFilter]);
  const filteredOrders = useMemo(() => allDeliveryOrders.filter(baseFilter), [allDeliveryOrders, baseFilter]);

  const filteredCouriers = useMemo(() => {
    return couriersList.filter((c) => {
      if (courierFilterActive === 'active' && !c.isActive) return false;
      if (courierFilterActive === 'inactive' && c.isActive) return false;
      if (courierFilterAvailable === 'available' && c.isAvailable === false) return false;
      if (courierFilterAvailable === 'busy' && c.isAvailable !== false) return false;
      return true;
    });
  }, [couriersList, courierFilterActive, courierFilterAvailable]);

  const statsList = courierStats as MarketCourierWithStats[];
  const filteredStats = useMemo(() => {
    return statsList.filter((c) => {
      if (statsFilterActive === 'active' && !c.isActive) return false;
      if (statsFilterActive === 'inactive' && c.isActive) return false;
      if (statsFilterAvailable === 'available' && c.isAvailable === false) return false;
      if (statsFilterAvailable === 'busy' && c.isAvailable !== false) return false;
      return true;
    });
  }, [statsList, statsFilterActive, statsFilterAvailable]);

  const statsByCourierId = useMemo(() => new Map(statsList.map((c) => [c.id, c])), [statsList]);

  const sortedStats = useMemo(() => {
    const arr = [...filteredStats];
    const key = statsSortBy;
    const dir = statsSortDir === 'asc' ? 1 : -1;
    const getNum = (c: MarketCourierWithStats): number => {
      const v = (c as unknown as Record<string, unknown>)[key];
      return typeof v === 'number' ? v : 0;
    };
    arr.sort((a, b) => {
      const na = getNum(a);
      const nb = getNum(b);
      if (na !== nb) return dir * (na - nb);
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
    return arr;
  }, [filteredStats, statsSortBy, statsSortDir]);

  const getAssignableCouriers = (order: OrderRow) => {
    const currentCourierId = order.courierId;
    if (currentCourierId) {
      const current = couriersList.find((c) => c.id === currentCourierId);
      if (current && !availableCouriers.some((c) => c.id === currentCourierId)) {
        return [current, ...availableCouriers.filter((c) => c.id !== currentCourierId)];
      }
    }
    return availableCouriers;
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard?.writeText(phone).then(() => addToast('تم نسخ الرقم', 'success')).catch(() => addToast('فشل النسخ', 'error'));
  };

  const openWhatsAppModal = (
    order: OrderRow,
    recipient: 'customer' | 'courier',
    courier?: MarketCourier
  ) => {
    const tenant = tenants.find((t: { id?: string }) => t.id === order.tenantId) as { id: string; name: string } | undefined;
    if (recipient === 'customer') {
      const phone = (order.customerPhone ?? '').replace(/\D/g, '').replace(/^0/, '972');
      const tenantForMsg: Tenant = {
        id: tenant?.id ?? '',
        name: tenant?.name ?? '',
        slug: '',
        type: 'GENERAL',
        marketCategory: 'GENERAL',
        branding: { logoUrl: '', primaryColor: '', secondaryColor: '', fontFamily: '', radiusScale: 1, layoutStyle: 'default' },
      };
      const orderForMsg = order as Order;
      const msg = buildWhatsAppMessage(orderForMsg, tenantForMsg);
      setWhatsAppModal({
        order,
        tenant: tenant ?? { id: '', name: '' },
        recipient: 'customer',
        phone,
        name: order.customerName ?? '',
        initialMessage: msg,
      });
    } else if (courier) {
      const phone = (courier.phone ?? '').replace(/\D/g, '').replace(/^0/, '972');
      setWhatsAppModal({
        order,
        tenant: tenant ?? { id: '', name: '' },
        recipient: 'courier',
        phone,
        name: courier.name,
        initialMessage: `مرحباً ${courier.name}، لديك طلب جديد للتوصيل #${(order.id ?? '').slice(0, 8)}`,
      });
    }
  };

  const createJobMutation = useMutation({
    mutationFn: (orderIds: string[]) => {
      const orderIdToTenant = new Map<string, string>();
      (queue as { id?: string; tenantId?: string }[]).forEach((o) => {
        if (o.id && o.tenantId) orderIdToTenant.set(o.id, o.tenantId);
      });
      const items = orderIds.map((oid) => ({ orderId: oid, tenantId: orderIdToTenant.get(oid) ?? '' })).filter((i) => i.tenantId);
      return api.createDeliveryJob(marketId!, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-jobs', marketId] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-queue', marketId] });
      addToast('تم إنشاء المهمة', 'success');
      setCreateJobModalOpen(false);
      setSelectedOrderIds(new Set());
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ jobId, courierId }: { jobId: string; courierId: string }) =>
      api.assignDeliveryJob(marketId!, jobId, courierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-jobs', marketId] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-queue', marketId] });
      addToast('تم التعيين', 'success');
      setAssignJobId(null);
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const assignOrderCourierMutation = useMutation({
    mutationFn: ({ orderId, courierId, reassign }: { orderId: string; courierId: string; reassign?: boolean }) =>
      api.assignCourierToOrder(marketId!, orderId, courierId, reassign),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-orders', marketId] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-queue', marketId] });
      queryClient.invalidateQueries({ queryKey: ['market-couriers', marketId] });
      addToast('تم تعيين السائق للطلب', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const patchCourierMutation = useMutation({
    mutationFn: ({ courierId, updates }: { courierId: string; updates: { isOnline?: boolean; isActive?: boolean; isAvailable?: boolean } }) =>
      api.patchMarketCourier(marketId!, courierId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-couriers', marketId] });
      addToast('تم التحديث', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const createCourierMutation = useMutation({
    mutationFn: () => api.createMarketCourier(marketId!, { name: newCourierName.trim(), phone: newCourierPhone.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-couriers', marketId] });
      addToast('تم إضافة السائق', 'success');
      setAddCourierModalOpen(false);
      setNewCourierName('');
      setNewCourierPhone('');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const updateCourierMutation = useMutation({
    mutationFn: () =>
      api.patchMarketCourier(marketId!, editCourierModalOpen!.id, {
        name: editCourierName.trim(),
        phone: editCourierPhone.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-couriers', marketId] });
      addToast('تم تحديث السائق', 'success');
      setEditCourierModalOpen(null);
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock-api accepts OUT_FOR_DELIVERY/DELIVERED
      api.updateOrderStatus(orderId, status as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-orders', marketId] });
      queryClient.invalidateQueries({ queryKey: ['market-couriers', marketId] });
      addToast('تم تحديث حالة الطلب', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const unassignMutation = useMutation({
    mutationFn: (orderId: string) => api.unassignCourierFromOrder(marketId!, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-orders', marketId] });
      queryClient.invalidateQueries({ queryKey: ['market-couriers', marketId] });
      addToast('تم إلغاء تعيين السائق', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const logContactMutation = useMutation({
    mutationFn: ({ orderId, message }: { orderId: string; message?: string }) =>
      api.logOrderContact(marketId!, orderId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-orders', marketId] });
      addToast('تم تسجيل التواصل', 'success');
      setWhatsAppModal(null);
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const renderOrdersTable = (orders: OrderRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-start font-medium text-gray-700">الطلب</th>
            <th className="px-4 py-2 text-start font-medium text-gray-700">العميل</th>
            <th className="px-4 py-2 text-start font-medium text-gray-700">المستأجر</th>
            <th className="px-4 py-2 text-start font-medium text-gray-700">السائق</th>
            <th className="px-4 py-2 text-start font-medium text-gray-700">الحالة</th>
            <th className="px-4 py-2 text-start font-medium text-gray-700">المدة / SLA</th>
            <th className="px-4 py-2 text-start font-medium text-gray-700">جاهز في</th>
            <th className="px-4 py-2 text-start font-medium text-gray-700">إجراء</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const isMarket = o.deliveryAssignmentMode === 'MARKET';
            const canAssign = isMarket && !o.courierId;
            const courier = o.courierId ? couriersList.find((c) => c.id === o.courierId) : null;
            const status = o.status ?? '';
            const deliveryStatus = o.deliveryStatus ?? (o.courierId ? 'ASSIGNED' : 'UNASSIGNED');
            const statusBadgeClass =
              status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
              status === 'OUT_FOR_DELIVERY' ? 'bg-purple-100 text-purple-800' :
              status === 'READY' ? 'bg-blue-100 text-blue-800' :
              status === 'PREPARING' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800';
            const statusLabel = status === 'DELIVERED' ? 'تم التسليم' : status === 'OUT_FOR_DELIVERY' ? 'خارج للتوصيل' : status === 'READY' ? 'جاهز' : status === 'PREPARING' ? 'قيد التحضير' : status || '-';
            const deliveryStatusLabel = DELIVERY_STATUS_LABELS[deliveryStatus] ?? deliveryStatus;
            const deliveryStatusClass = DELIVERY_STATUS_CLASSES[deliveryStatus] ?? 'bg-gray-100 text-gray-700';
            const respBadge = isMarket ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700';
            const assignableCouriers = getAssignableCouriers(o);
            return (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-mono text-xs">{o.id?.slice(0, 8) ?? '-'}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span>{o.customerName ?? '-'}</span>
                    {o.customerPhone && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openWhatsAppModal(o, 'customer')}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-green-600 text-white text-xs hover:bg-green-700"
                        >
                          <MessageCircle className="w-3 h-3" /> واتساب
                        </button>
                        <a href={`tel:${o.customerPhone}`} className="text-primary hover:underline text-xs flex items-center gap-0.5">
                          <Phone className="w-3 h-3" /> {o.customerPhone}
                        </a>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">{tenantMap.get(o.tenantId ?? '') ?? o.tenantId}</td>
                <td className="px-4 py-2">
                  {courier ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{courier.name}</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openWhatsAppModal(o, 'courier', courier)}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-green-600 text-white text-xs hover:bg-green-700"
                        >
                          <MessageCircle className="w-3 h-3" /> واتساب
                        </button>
                        <a href={`tel:${courier.phone}`} className="text-primary hover:underline flex items-center gap-0.5 text-xs">
                          <Phone className="w-3 h-3" /> {courier.phone}
                        </a>
                        <button type="button" onClick={() => copyPhone(courier.phone!)} className="p-0.5 rounded hover:bg-gray-100" title="نسخ"><Copy className="w-3 h-3 text-gray-500" /></button>
                      </div>
                    </div>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded ${respBadge}`}>{isMarket ? 'السوق' : 'المحل'}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass}`}>{statusLabel}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${deliveryStatusClass}`}>{deliveryStatusLabel}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <DurationAndSla order={o} />
                </td>
                <td className="px-4 py-2 text-gray-500">{o.readyAt ? new Date(o.readyAt).toLocaleTimeString('ar-SA') : '-'}</td>
                <td className="px-4 py-2 flex flex-wrap gap-1">
                  {canAssign && (
                    <select
                      className="h-8 px-2 rounded border border-gray-300 text-sm min-w-[120px]"
                      value=""
                      onChange={(e) => {
                        const cid = e.target.value;
                        if (cid) assignOrderCourierMutation.mutate({ orderId: o.id!, courierId: cid });
                      }}
                      disabled={assignableCouriers.length === 0 || !canWrite}
                    >
                      <option value="">تعيين سائق</option>
                      {assignableCouriers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} — {c.phone ?? '-'}</option>
                      ))}
                    </select>
                  )}
                  {o.courierId && !canAssign && (
                    <select
                      className="h-8 px-2 rounded border border-gray-300 text-sm min-w-[120px]"
                      value={o.courierId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        if (cid && cid !== o.courierId) assignOrderCourierMutation.mutate({ orderId: o.id!, courierId: cid, reassign: true });
                      }}
                      disabled={!canWrite}
                    >
                      {assignableCouriers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  {o.courierId && status !== 'OUT_FOR_DELIVERY' && status !== 'DELIVERED' && (
                    <Button size="sm" variant="outline" onClick={() => unassignMutation.mutate(o.id ?? '')} disabled={unassignMutation.isPending || !canWrite}>إلغاء التعيين</Button>
                  )}
                  {o.courierId && status === 'READY' && (
                    <Button size="sm" variant="outline" onClick={() => updateOrderStatusMutation.mutate({ orderId: o.id!, status: 'OUT_FOR_DELIVERY' })} disabled={updateOrderStatusMutation.isPending || !canWrite}>خرج للتوصيل</Button>
                  )}
                  {status === 'OUT_FOR_DELIVERY' && (
                    <Button size="sm" onClick={() => updateOrderStatusMutation.mutate({ orderId: o.id!, status: 'DELIVERED' })} disabled={updateOrderStatusMutation.isPending || !canWrite}>تم التسليم</Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (!marketId || !MOCK_API_URL) return null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/markets/${marketId}`} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          رجوع
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">إدارة التوصيل - {market?.name ?? marketId}</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{dashboardStats.queue}</p>
            <p className="text-sm text-gray-500">قائمة الانتظار</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{dashboardStats.assigned}</p>
            <p className="text-sm text-gray-500">معيّن</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100 text-green-700">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{dashboardStats.delivered}</p>
            <p className="text-sm text-gray-500">تم التسليم</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{dashboardStats.availableCouriers}</p>
            <p className="text-sm text-gray-500">سائقون متاحون</p>
          </div>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="بحث (رقم الطلب، العميل، المستأجر)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select
            value={filterTenant}
            onChange={(e) => setFilterTenant(e.target.value)}
            options={[
              { value: '', label: 'كل المستأجرين' },
              ...Array.from(new Set(allDeliveryOrders.map((o) => o.tenantId).filter(Boolean)))
                .map((tid) => ({ value: tid!, label: tenantMap.get(tid ?? '') ?? tid ?? '' })),
            ]}
            className="min-w-[140px]"
          />
          <Select
            value={filterCourier}
            onChange={(e) => setFilterCourier(e.target.value)}
            options={[
              { value: '', label: 'كل السائقين' },
              ...couriersList.map((c) => ({ value: c.id, label: c.name })),
            ]}
            className="min-w-[140px]"
          />
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: '', label: 'كل الحالات' },
              { value: 'UNASSIGNED', label: 'غير معيّن' },
              { value: 'ASSIGNED', label: 'معيّن' },
              { value: 'PICKED_UP', label: 'خارج للتوصيل' },
              { value: 'DELIVERED', label: 'تم التسليم' },
            ]}
            className="min-w-[140px]"
          />
        </div>
      </Card>

      <Tabs value={activeTab} onChange={setActiveTab} className="transition-opacity duration-200">
        <TabsList>
          <TabsTrigger value="queue">قائمة الانتظار ({queueFiltered.length})</TabsTrigger>
          <TabsTrigger value="assigned">معيّن ({assignedFiltered.length})</TabsTrigger>
          <TabsTrigger value="all">الكل ({filteredOrders.length})</TabsTrigger>
          <TabsTrigger value="couriers">السائقون ({filteredCouriers.length})</TabsTrigger>
          <TabsTrigger value="stats">إحصائيات السائقين ({filteredStats.length})</TabsTrigger>
          <TabsTrigger value="leaderboard">لوحة المتصدرين</TabsTrigger>
          <TabsTrigger value="jobs">المهام ({jobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4 transition-opacity duration-200">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-600">طلبات جاهزة للتوصيل (لم تُعيَّن بعد)</span>
              <Button size="sm" onClick={() => setCreateJobModalOpen(true)} disabled={queue.length === 0 || !canWrite}>
                إنشاء مهمة
              </Button>
            </div>
            {ordersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rectangular" className="h-12 w-full" />
                ))}
              </div>
            ) : queueFiltered.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">لا توجد طلبات في قائمة الانتظار</p>
            ) : (
              renderOrdersTable(queueFiltered)
            )}
          </Card>
        </TabsContent>

        <TabsContent value="assigned" className="mt-4 transition-opacity duration-200">
          <Card className="p-4">
            {ordersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rectangular" className="h-12 w-full" />
                ))}
              </div>
            ) : assignedFiltered.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">لا توجد طلبات معيّنة</p>
            ) : (
              renderOrdersTable(assignedFiltered)
            )}
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4 transition-opacity duration-200">
          <Card className="p-4">
            {ordersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} variant="rectangular" className="h-12 w-full" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">لا توجد طلبات توصيل</p>
            ) : (
              renderOrdersTable(filteredOrders)
            )}
          </Card>
        </TabsContent>

        <TabsContent value="couriers" className="mt-4 transition-opacity duration-200">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={courierFilterActive}
                  onChange={(e) => setCourierFilterActive(e.target.value)}
                  options={[
                    { value: '', label: 'كل الحالة' },
                    { value: 'active', label: 'نشط' },
                    { value: 'inactive', label: 'غير نشط' },
                  ]}
                  className="min-w-[100px]"
                />
                <Select
                  value={courierFilterAvailable}
                  onChange={(e) => setCourierFilterAvailable(e.target.value)}
                  options={[
                    { value: '', label: 'كل التوفر' },
                    { value: 'available', label: 'متاح' },
                    { value: 'busy', label: 'مشغول' },
                  ]}
                  className="min-w-[100px]"
                />
              </div>
              <Button size="sm" onClick={() => setAddCourierModalOpen(true)} disabled={!canWrite}>إضافة سائق</Button>
            </div>
            {couriersList.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">لا يوجد سائقون</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الاسم</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الجوال</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الحالة</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">التوصيلات</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">النقاط / الشارات</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCouriers.map((c) => {
                      const s = statsByCourierId.get(c.id);
                      return (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 font-medium">{c.name}</td>
                        <td className="px-4 py-2">{c.phone ?? '-'}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {c.isActive ? 'نشط' : 'غير نشط'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${c.isAvailable !== false ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                              {c.isAvailable !== false ? 'متاح' : 'مشغول'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">{c.deliveryCount ?? 0}</td>
                        <td className="px-4 py-2">
                          {s ? (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="text-teal-600 font-medium text-xs">{s.pointsToday ?? 0}/{s.pointsWeek ?? 0}</span>
                              {(s.badgesWeek?.length ?? 0) > 0 && s.badgesWeek!.map((b) => (
                                <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{b}</span>
                              ))}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2 flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditCourierModalOpen(c);
                              setEditCourierName(c.name);
                              setEditCourierPhone(c.phone ?? '');
                            }}
                            disabled={!canWrite}
                          >
                            تعديل
                          </Button>
                          <button
                            type="button"
                            onClick={() => patchCourierMutation.mutate({ courierId: c.id, updates: { isActive: !c.isActive } })}
                            disabled={!canWrite}
                            className="text-sm text-primary hover:underline"
                          >
                            {c.isActive ? 'تعطيل' : 'تفعيل'}
                          </button>
                          <button
                            type="button"
                            onClick={() => patchCourierMutation.mutate({ courierId: c.id, updates: { isAvailable: c.isAvailable === false } })}
                            disabled={!canWrite}
                            className="text-sm text-primary hover:underline"
                          >
                            {c.isAvailable === false ? 'متاح' : 'مشغول'}
                          </button>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-4 transition-opacity duration-200">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={statsFilterActive}
                  onChange={(e) => setStatsFilterActive(e.target.value)}
                  options={[
                    { value: '', label: 'كل الحالة' },
                    { value: 'active', label: 'نشط' },
                    { value: 'inactive', label: 'غير نشط' },
                  ]}
                  className="min-w-[100px]"
                />
                <Select
                  value={statsFilterAvailable}
                  onChange={(e) => setStatsFilterAvailable(e.target.value)}
                  options={[
                    { value: '', label: 'كل التوفر' },
                    { value: 'available', label: 'متاح' },
                    { value: 'busy', label: 'مشغول' },
                  ]}
                  className="min-w-[100px]"
                />
                <Select
                  value={statsSortBy}
                  onChange={(e) => setStatsSortBy(e.target.value)}
                  options={[
                    { value: 'deliveredCountWeek', label: 'ترتيب: الأسبوع' },
                    { value: 'deliveredCountToday', label: 'ترتيب: اليوم' },
                    { value: 'avgTotalMin', label: 'ترتيب: متوسط المدة' },
                    { value: 'onTimeRate', label: 'ترتيب: ضمن SLA' },
                  ]}
                  className="min-w-[140px]"
                />
                <button
                  type="button"
                  onClick={() => setStatsSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="text-sm text-gray-600 hover:text-gray-900 px-2"
                  title={statsSortDir === 'desc' ? 'تنازلي ← تصاعدي' : 'تصاعدي ← تنازلي'}
                >
                  {statsSortDir === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>
            {statsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rectangular" className="h-12 w-full" />
                ))}
              </div>
            ) : sortedStats.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">لا توجد بيانات</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الاسم</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الجوال</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الحالة</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">اليوم</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الأسبوع</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">النقاط</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الشارات</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">متوسط د</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">استلام→توصيل</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">ضمن SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStats.map((c) => (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 font-medium">{c.name}</td>
                        <td className="px-4 py-2">{c.phone ?? '-'}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {c.isActive ? 'نشط' : 'غير نشط'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${c.isAvailable !== false ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                              {c.isAvailable !== false ? 'متاح' : 'مشغول'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">{c.deliveredCountToday ?? 0}</td>
                        <td className="px-4 py-2">{c.deliveredCountWeek ?? 0}</td>
                        <td className="px-4 py-2">
                          <span className="text-teal-600 font-medium">{c.pointsToday ?? 0}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-teal-600 font-medium">{c.pointsWeek ?? 0}</span>
                        </td>
                        <td className="px-4 py-2">
                          {(c.badgesWeek?.length ?? 0) > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {c.badgesWeek!.map((b) => (
                                <span key={b} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  {b}
                                </span>
                              ))}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2">{c.avgTotalMin != null ? `${c.avgTotalMin} د` : '—'}</td>
                        <td className="px-4 py-2">{c.avgPickupToDeliveredMin != null ? `${c.avgPickupToDeliveredMin} د` : '—'}</td>
                        <td className="px-4 py-2">
                          {c.onTimeRate != null ? (
                            <span className={c.onTimeRate >= 80 ? 'text-green-700 font-medium' : c.onTimeRate >= 50 ? 'text-amber-700' : 'text-red-700'}>
                              {c.onTimeRate}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4 transition-opacity duration-200">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">لوحة المتصدرين (الأسبوع)</h3>
            {leaderboardLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} variant="rectangular" className="h-12 w-full" />
                ))}
              </div>
            ) : !leaderboardData?.leaderboard?.length ? (
              <p className="text-gray-500 py-8 text-center">لا توجد بيانات</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الترتيب</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الاسم</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">النقاط</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">الشارات</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">متوسط د</th>
                      <th className="px-4 py-2 text-start font-medium text-gray-700">ضمن SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.leaderboard.map((r: { courierId: string; name: string; pointsWeek: number; badgesWeek?: string[]; avgTotalMin?: number | null; onTimeRate?: number | null; rank: number }) => (
                      <tr key={r.courierId} className="border-t border-gray-100">
                        <td className="px-4 py-2 font-semibold text-teal-600">#{r.rank}</td>
                        <td className="px-4 py-2 font-medium">{r.name}</td>
                        <td className="px-4 py-2 font-semibold">{r.pointsWeek}</td>
                        <td className="px-4 py-2">
                          {(r.badgesWeek?.length ?? 0) > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.badgesWeek!.map((b: string) => (
                                <span key={b} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  {b}
                                </span>
                              ))}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2">{r.avgTotalMin != null ? `${r.avgTotalMin} د` : '—'}</td>
                        <td className="px-4 py-2">
                          {r.onTimeRate != null ? (
                            <span className={r.onTimeRate >= 80 ? 'text-green-600 font-medium' : r.onTimeRate >= 50 ? 'text-amber-600' : 'text-gray-600'}>
                              {r.onTimeRate}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card className="p-4 mt-4">
            <div className="space-y-3">
              {jobs.length === 0 ? (
                <p className="text-gray-500 py-8 text-center">لا توجد مهام توصيل</p>
              ) : (
                (jobs as { id: string; status: string; courierId?: string; items: { orderId: string; tenantId: string }[] }[]).map((j) => (
                  <div key={j.id} className="p-3 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-xs">{j.id.slice(0, 8)}</span>
                        <span className="ms-2 text-sm text-gray-600">— {j.status}</span>
                      </div>
                      {j.status === 'NEW' && !j.courierId && (
                        <Button
                          size="sm"
                          onClick={() => setAssignJobId(j.id)}
                          disabled={couriers.filter((c: { isOnline: boolean }) => c.isOnline).length === 0 || !canWrite}
                        >
                          تعيين سائق
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      الطلبات: {j.items.map((i) => i.orderId.slice(0, 8)).join(', ')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Modal open={createJobModalOpen} onClose={() => setCreateJobModalOpen(false)} title="إنشاء مهمة توصيل" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">اختر الطلبات للمهمة:</p>
          <div className="max-h-48 overflow-y-auto border rounded divide-y">
            {(queue as { id?: string; tenantId?: string }[]).map((o) => (
              <label key={o.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedOrderIds.has(o.id ?? '')}
                  onChange={(e) => {
                    setSelectedOrderIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(o.id ?? '');
                      else next.delete(o.id ?? '');
                      return next;
                    });
                  }}
                />
                <span className="font-mono text-xs">{o.id?.slice(0, 8)}</span>
                <span className="text-gray-500">— {tenantMap.get(o.tenantId ?? '')}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setCreateJobModalOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => createJobMutation.mutate(Array.from(selectedOrderIds))}
              disabled={selectedOrderIds.size === 0 || createJobMutation.isPending || !canWrite}
            >
              {createJobMutation.isPending ? 'جاري...' : 'إنشاء'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={addCourierModalOpen} onClose={() => setAddCourierModalOpen(false)} title="إضافة سائق" size="sm">
        <div className="space-y-4">
          <Input
            placeholder="الاسم"
            value={newCourierName}
            onChange={(e) => setNewCourierName(e.target.value)}
          />
          <Input
            placeholder="رقم الجوال"
            value={newCourierPhone}
            onChange={(e) => setNewCourierPhone(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setAddCourierModalOpen(false)}>إلغاء</Button>
            <Button onClick={() => createCourierMutation.mutate()} disabled={!newCourierName.trim() || createCourierMutation.isPending || !canWrite}>
              {createCourierMutation.isPending ? 'جاري...' : 'إضافة'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editCourierModalOpen}
        onClose={() => setEditCourierModalOpen(null)}
        title="تعديل سائق"
        size="sm"
      >
        {editCourierModalOpen && (
          <div className="space-y-4">
            <Input
              placeholder="الاسم"
              value={editCourierName}
              onChange={(e) => setEditCourierName(e.target.value)}
            />
            <Input
              placeholder="رقم الجوال"
              value={editCourierPhone}
              onChange={(e) => setEditCourierPhone(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditCourierModalOpen(null)}>إلغاء</Button>
              <Button
                onClick={() => updateCourierMutation.mutate()}
                disabled={updateCourierMutation.isPending || !canWrite}
              >
                {updateCourierMutation.isPending ? 'جاري...' : 'حفظ'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!assignJobId} onClose={() => setAssignJobId(null)} title="تعيين سائق للمهمة" size="sm">
        {assignJobId && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">اختر السائق:</p>
            <div className="space-y-2">
              {availableCouriers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => assignMutation.mutate({ jobId: assignJobId, courierId: c.id })}
                  disabled={!canWrite}
                  className="w-full p-2 text-start rounded border hover:bg-gray-50 disabled:opacity-50"
                >
                  {c.name} — {c.phone ?? '-'}
                </button>
              ))}
            </div>
            {availableCouriers.length === 0 && (
              <p className="text-sm text-amber-600">لا يوجد سائقون متصلون</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!whatsAppModal}
        onClose={() => setWhatsAppModal(null)}
        title={`واتساب - ${whatsAppModal?.recipient === 'customer' ? 'العميل' : 'السائق'}`}
        size="md"
      >
        {whatsAppModal && (
          <WhatsAppModalContent
            modal={whatsAppModal}
            onClose={() => setWhatsAppModal(null)}
            onCopy={() => {
              navigator.clipboard?.writeText(whatsAppModal.initialMessage).then(() => addToast('تم النسخ', 'success'));
            }}
            onLogContact={(msg) => logContactMutation.mutate({ orderId: whatsAppModal.order.id!, message: msg })}
            isLogging={logContactMutation.isPending}
            canWrite={canWrite}
          />
        )}
      </Modal>
    </div>
  );
}

function WhatsAppModalContent({
  modal,
  onClose,
  onCopy,
  onLogContact,
  isLogging,
  canWrite,
}: {
  modal: { phone: string; name: string; initialMessage: string };
  onClose: () => void;
  onCopy: () => void;
  onLogContact: (msg?: string) => void;
  isLogging: boolean;
  canWrite: boolean;
}) {
  const [message, setMessage] = useState(modal.initialMessage);
  const waUrl = buildWhatsAppUrl(modal.phone, message);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">إلى: {modal.name}</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        placeholder="الرسالة"
      />
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50"
        >
          <Copy className="w-4 h-4" /> نسخ
        </button>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700"
        >
          <MessageCircle className="w-4 h-4" /> فتح واتساب
        </a>
        <button
          type="button"
          onClick={() => onLogContact(message)}
          disabled={isLogging || !canWrite}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isLogging ? 'جاري...' : 'تسجيل التواصل'}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50">
          إغلاق
        </button>
      </div>
    </div>
  );
}
