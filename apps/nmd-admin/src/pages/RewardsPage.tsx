import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Modal, useToast } from '@nmd/ui';
import {
  listGlobalRewardsAdmin,
  createGlobalReward,
  updateGlobalReward,
  deleteGlobalReward,
  apiUpload,
  listRewardRedemptions,
  updateRewardRedemptionStatus,
  downloadRewardRedemptionsCsv,
  type GlobalRewardAdmin,
  type GlobalRewardType,
  type RewardRedemptionRow,
} from '../api';
import { Plus, Trash2, Pencil, ImagePlus, Coins, Package, Sparkles, Users, Download, CheckCircle, XCircle } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

const REWARD_TYPES: { value: GlobalRewardType; labelAr: string; labelEn: string }[] = [
  { value: 'COUPON', labelAr: 'قسيمة', labelEn: 'Coupon' },
  { value: 'EVENT', labelAr: 'فعالية', labelEn: 'Event' },
  { value: 'PRIZE', labelAr: 'جائزة', labelEn: 'Prize' },
  { value: 'TOURNAMENT', labelAr: 'بطولة', labelEn: 'Tournament' },
];

const emptyForm = {
  titleAr: '',
  titleEn: '',
  description: '',
  imageUrl: '',
  type: 'PRIZE' as GlobalRewardType,
  coinsCost: '0',
  stockLimit: '0',
  expiryDate: '',
  isActive: true,
};

export default function RewardsPage() {
  const addToast = useToast().addToast;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalRewardAdmin | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'catalog' | 'participants'>('catalog');
  const [filterRewardId, setFilterRewardId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | RewardRedemptionRow['status']>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const typeLabels = useMemo(() => Object.fromEntries(REWARD_TYPES.map((t) => [t.value, `${t.labelAr} / ${t.labelEn}`])), []);

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['global-rewards-admin'],
    queryFn: listGlobalRewardsAdmin,
    enabled: !!MOCK_API_URL,
  });

  const createMutation = useMutation({
    mutationFn: createGlobalReward,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-rewards-admin'] });
      closeModal();
      addToast('تم إنشاء المكافأة', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateGlobalReward>[1] }) => updateGlobalReward(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-rewards-admin'] });
      closeModal();
      addToast('تم حفظ التغييرات', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGlobalReward,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-rewards-admin'] });
      addToast('تم الحذف', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const { data: redemptions = [], isLoading: redemptionsLoading } = useQuery({
    queryKey: ['reward-redemptions', filterRewardId],
    queryFn: () => listRewardRedemptions(filterRewardId || undefined),
    enabled: !!MOCK_API_URL && tab === 'participants',
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RewardRedemptionRow['status'] }) => updateRewardRedemptionStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-redemptions'] });
      queryClient.invalidateQueries({ queryKey: ['global-rewards-admin'] });
      addToast('تم تحديث الحالة', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const openParticipantsForReward = (rewardId: string) => {
    setFilterRewardId(rewardId);
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setTab('participants');
  };

  const filteredRedemptions = useMemo(() => {
    return redemptions.filter((row) => {
      if (filterStatus && row.status !== filterStatus) return false;
      if (filterDateFrom) {
        const from = new Date(`${filterDateFrom}T00:00:00`);
        if (new Date(row.redeemedAt) < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(`${filterDateTo}T23:59:59.999`);
        if (new Date(row.redeemedAt) > to) return false;
      }
      return true;
    });
  }, [redemptions, filterStatus, filterDateFrom, filterDateTo]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (r: GlobalRewardAdmin) => {
    setEditing(r);
    setForm({
      titleAr: r.titleAr,
      titleEn: r.titleEn,
      description: r.description ?? '',
      imageUrl: r.imageUrl ?? '',
      type: r.type,
      coinsCost: String(r.coinsCost),
      stockLimit: String(r.stockLimit),
      expiryDate: r.expiryDate ? r.expiryDate.slice(0, 10) : '',
      isActive: r.isActive,
    });
    setModalOpen(true);
  };

  const handleImage = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const { urls } = await apiUpload([f]);
      if (urls[0]) setForm((prev) => ({ ...prev, imageUrl: urls[0] }));
      addToast('تم رفع الصورة', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل الرفع', 'error');
    } finally {
      setUploading(false);
    }
  };

  const parseNum = (s: string) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const submit = () => {
    const titleAr = form.titleAr.trim();
    const titleEn = form.titleEn.trim();
    if (!titleAr || !titleEn) {
      addToast('أدخل العنوان بالعربية والإنجليزية', 'error');
      return;
    }
    const body = {
      titleAr,
      titleEn,
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      type: form.type,
      coinsCost: parseNum(form.coinsCost),
      stockLimit: parseNum(form.stockLimit),
      expiryDate: form.expiryDate.trim() || undefined,
      isActive: form.isActive,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  if (!MOCK_API_URL) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">المكافآت والأنشطة</h1>
        <Card className="p-6 border border-teal-100">
          <p className="text-sm text-amber-700">يتطلب الاتصال بالـ API (VITE_MOCK_API_URL)</p>
        </Card>
      </div>
    );
  }

  const formatDt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const statusBadge = (s: RewardRedemptionRow['status']) => {
    if (s === 'COMPLETED') return 'bg-emerald-100 text-emerald-800';
    if (s === 'CANCELLED') return 'bg-gray-200 text-gray-700';
    return 'bg-amber-100 text-amber-900';
  };

  const statusLabel = (s: RewardRedemptionRow['status']) => {
    if (s === 'COMPLETED') return 'مكتمل';
    if (s === 'CANCELLED') return 'ملغى';
    return 'قيد الانتظار';
  };

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-teal-600" />
            المكافآت والأنشطة العالمية
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            إدارة القسائم، الفعاليات، الجوائز والبطولات — يظهر للعملاء عبر <code className="text-xs bg-teal-50 px-1 rounded text-teal-800">GET /rewards</code>
          </p>
        </div>
        {tab === 'catalog' && (
          <Button onClick={openCreate} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white border-0">
            <Plus className="w-4 h-4" />
            إنشاء مكافأة
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-1">
        <button
          type="button"
          onClick={() => setTab('catalog')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            tab === 'catalog' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Package className="w-4 h-4" />
            المكافآت
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('participants')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
            tab === 'participants' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Users className="w-4 h-4" />
            المشاركون والاسترداد
          </span>
        </button>
      </div>

      {tab === 'participants' && (
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">تصفية حسب المكافأة:</label>
              <select
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[200px] focus:ring-2 focus:ring-teal-500"
                value={filterRewardId}
                onChange={(e) => setFilterRewardId(e.target.value)}
              >
                <option value="">الكل</option>
                {rewards.map((rw) => (
                  <option key={rw.id} value={rw.id}>
                    {rw.titleAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">الحالة:</label>
                <select
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[140px] focus:ring-2 focus:ring-teal-500"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as '' | RewardRedemptionRow['status'])}
                >
                  <option value="">الكل</option>
                  <option value="PENDING">قيد الانتظار</option>
                  <option value="COMPLETED">مكتمل</option>
                  <option value="CANCELLED">ملغى</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">من:</label>
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-auto" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">إلى:</label>
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-auto" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2 border-teal-200 text-teal-800"
                onClick={() => void downloadRewardRedemptionsCsv(filterRewardId || undefined).catch((e) => addToast(e instanceof Error ? e.message : 'فشل التصدير', 'error'))}
              >
                <Download className="w-4 h-4" />
                تحميل CSV
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            يُخصم رصيد العملات تلقائياً عند انضمام العميل عبر <code className="bg-gray-100 px-1 rounded">POST /customer/rewards/:rewardId/redeem</code> (يتطلب تسجيل دخول العميل).
          </p>
        </div>
      )}

      {tab === 'participants' && (
        <Card className="overflow-hidden border border-gray-200 shadow-sm mb-8">
          {redemptionsLoading ? (
            <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
          ) : filteredRedemptions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto text-teal-200 mb-3" />
              لا توجد مشاركات مطابقة للتصفية.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-l from-teal-50 to-white border-b border-teal-100">
                  <tr>
                    <th className="px-3 py-3 text-start font-semibold text-teal-900">الاسم</th>
                    <th className="px-3 py-3 text-start font-semibold text-teal-900">الهاتف</th>
                    <th className="px-3 py-3 text-start font-semibold text-teal-900">المكافأة</th>
                    <th className="px-3 py-3 text-start font-semibold text-teal-900">النوع</th>
                    <th className="px-3 py-3 text-start font-semibold text-teal-900">العملات</th>
                    <th className="px-3 py-3 text-start font-semibold text-teal-900">التاريخ</th>
                    <th className="px-3 py-3 text-start font-semibold text-teal-900">الحالة</th>
                    <th className="px-3 py-3 text-start font-semibold text-teal-900 w-44">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRedemptions.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 hover:bg-teal-50/30">
                      <td className="px-3 py-3 font-medium text-gray-900">{row.customerName}</td>
                      <td className="px-3 py-3 text-gray-700 dir-ltr text-left">{row.customerPhone}</td>
                      <td className="px-3 py-3">
                        <div className="text-gray-900">{row.rewardTitleAr}</div>
                        <div className="text-xs text-gray-500">{row.rewardTitleEn}</div>
                      </td>
                      <td className="px-3 py-3">{typeLabels[row.type as GlobalRewardType] ?? row.type}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 text-teal-800">
                          <Coins className="w-3.5 h-3.5" />
                          {row.coinsSpent}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatDt(row.redeemedAt)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge(row.status)}`}>{statusLabel(row.status)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-8 text-xs"
                                onClick={() => statusMutation.mutate({ id: row.id, status: 'COMPLETED' })}
                                disabled={statusMutation.isPending}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                إكمال
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 h-8 text-xs text-red-700 border-red-200"
                                onClick={() => {
                                  if (confirm('إلغاء المشاركة واسترداد العملات للعميل؟')) {
                                    statusMutation.mutate({ id: row.id, status: 'CANCELLED' });
                                  }
                                }}
                                disabled={statusMutation.isPending}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                إلغاء
                              </Button>
                            </>
                          )}
                          {row.status !== 'PENDING' && <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'catalog' && (
      <Card className="overflow-hidden border border-gray-200 shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
        ) : rewards.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto text-teal-200 mb-3" />
            لا توجد مكافآت بعد. أنشئ أول قسيمة أو بطولة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-l from-teal-50 to-white border-b border-teal-100">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold text-teal-900">الصورة</th>
                  <th className="px-4 py-3 text-start font-semibold text-teal-900">العنوان</th>
                  <th className="px-4 py-3 text-start font-semibold text-teal-900">النوع</th>
                  <th className="px-4 py-3 text-start font-semibold text-teal-900">العملات</th>
                  <th className="px-4 py-3 text-start font-semibold text-teal-900">المخزون</th>
                  <th className="px-4 py-3 text-start font-semibold text-teal-900">المشاركون</th>
                  <th className="px-4 py-3 text-start font-semibold text-teal-900">الانتهاء</th>
                  <th className="px-4 py-3 text-start font-semibold text-teal-900">نشط</th>
                  <th className="px-4 py-3 text-start font-semibold text-teal-900 w-28">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-teal-50/40 transition-colors">
                    <td className="px-4 py-3">
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">—</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.titleAr}</div>
                      <div className="text-xs text-gray-500">{r.titleEn}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{typeLabels[r.type] ?? r.type}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-teal-800">
                        <Coins className="w-3.5 h-3.5" />
                        {r.coinsCost}
                      </span>
                    </td>
                    <td className="px-4 py-3">{r.stockLimit === 0 ? <span className="text-teal-600">غير محدود</span> : r.stockLimit}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-teal-900 font-medium">
                          <Users className="w-3.5 h-3.5" />
                          {r.participantCount ?? 0}
                        </span>
                        {(r.participantCount ?? 0) > 0 && (
                          <button
                            type="button"
                            className="text-xs text-teal-700 hover:underline text-start"
                            onClick={() => openParticipantsForReward(r.id)}
                          >
                            عرض المشاركين
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.expiryDate ? r.expiryDate.slice(0, 10) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={r.isActive ? 'text-emerald-600 font-medium' : 'text-gray-400'}>{r.isActive ? 'نعم' : 'لا'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="p-2 rounded-lg text-teal-700 hover:bg-teal-100"
                          onClick={() => openEdit(r)}
                          aria-label="تعديل"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (confirm('حذف هذه المكافأة نهائياً؟')) deleteMutation.mutate(r.id);
                          }}
                          aria-label="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'تعديل مكافأة' : 'إنشاء مكافأة'} size="lg">
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">العنوان (عربي)</label>
              <Input value={form.titleAr} onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))} placeholder="مثال: بطولة FIFA" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title (English)</label>
              <Input value={form.titleEn} onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))} placeholder="e.g. FIFA Tournament" dir="ltr" className="text-left" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
            <textarea
              className="w-full min-h-[88px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="تفاصيل المكافأة أو الشروط..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">صورة الغلاف</label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-teal-200 bg-teal-50/50 text-teal-800 cursor-pointer hover:bg-teal-50">
                <ImagePlus className="w-4 h-4" />
                {uploading ? 'جاري الرفع...' : 'رفع صورة'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleImage(e.target.files)} disabled={uploading} />
              </label>
              {form.imageUrl && (
                <span className="text-xs text-gray-500 truncate max-w-[200px]" title={form.imageUrl}>
                  {form.imageUrl}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">النوع</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as GlobalRewardType }))}
              >
                {REWARD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.labelAr} — {t.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تكلفة العملات</label>
                <Input type="number" min={0} value={form.coinsCost} onChange={(e) => setForm((f) => ({ ...f, coinsCost: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المخزون (0 = غير محدود)</label>
                <Input type="number" min={0} value={form.stockLimit} onChange={(e) => setForm((f) => ({ ...f, stockLimit: e.target.value }))} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء</label>
            <Input type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
            <span className="text-sm text-gray-700">نشط ويظهر للعملاء (ضمن شروط العرض)</span>
          </label>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="outline" onClick={closeModal}>
              إلغاء
            </Button>
            <Button
              onClick={submit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white border-0"
            >
              {editing ? 'حفظ' : 'إنشاء'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
