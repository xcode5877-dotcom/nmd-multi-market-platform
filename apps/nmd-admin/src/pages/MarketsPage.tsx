import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store, Plus, UserPlus } from 'lucide-react';
import { Card, Button, Modal, Input, useToast } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { apiFetch, apiHeaders } from '../api';
import { useEmergencyMode } from '../contexts/EmergencyModeContext';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface Market {
  id: string;
  name: string;
  slug: string;
  branding?: { primaryColor?: string };
  isActive: boolean;
  sortOrder?: number;
}

interface User {
  id: string;
  email: string;
  role: string;
  marketId?: string;
}

const api = new MockApiClient();

export default function MarketsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', primaryColor: '#D97706', isActive: true });
  const [addAdminModal, setAddAdminModal] = useState<Market | null>(null);
  const [addAdminEmail, setAddAdminEmail] = useState('');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL,
  });

  const isRootAdmin = me?.role === 'ROOT_ADMIN';
  const emergency = useEmergencyMode();
  const canEdit = !isRootAdmin || (emergency?.enabled ?? false);

  const { data: marketsData = [], isLoading: marketsLoading } = useQuery({
    queryKey: ['markets', me?.id],
    queryFn: () => fetch(`${MOCK_API_URL}/markets?all=true`, { headers: apiHeaders() }).then((r) => r.json()),
    enabled: !!MOCK_API_URL,
  });
  const markets = Array.isArray(marketsData) ? marketsData : [];

  const addAdminMutation = useMutation({
    mutationFn: async ({ marketId, email }: { marketId: string; email: string }) => {
      return apiFetch<User>(`/markets/${marketId}/admins`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-admins'] });
      addToast('تم إضافة المسؤول', 'success');
      setAddAdminModal(null);
      setAddAdminEmail('');
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل الإضافة', 'error');
    },
  });

  const saveMarket = async () => {
    if (!MOCK_API_URL) return;
    if (creating) {
      const res = await fetch(`${MOCK_API_URL}/markets`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          branding: { primaryColor: form.primaryColor },
          isActive: form.isActive,
        }),
      });
      await res.json();
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      setCreating(false);
    }
    setForm({ name: '', slug: '', primaryColor: '#D97706', isActive: true });
  };

  if (marketsLoading) {
    return <div className="text-gray-500">Loading markets...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الأسواق</h1>
        {isRootAdmin && (
          <Button
          disabled={!canEdit}
          title={!canEdit ? 'فعّل وضع الطوارئ مع سبب للتعديل' : undefined}
          onClick={() => {
            setCreating(true);
            setForm({ name: '', slug: '', primaryColor: '#D97706', isActive: true });
          }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            إضافة سوق
          </Button>
        )}
      </div>

      {me && (
        <div className="mb-4 text-sm text-gray-600">
          {me.role === 'ROOT_ADMIN' ? 'مسؤول عام' : `مسؤول سوق (${me.email})`}
        </div>
      )}

      {creating && isRootAdmin && canEdit && (
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">إنشاء سوق</h2>
          <div className="grid gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                placeholder="سوق دبورية الرقمي"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                placeholder="dabburiyya"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اللون الأساسي</label>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <span className="ms-2 text-sm text-gray-500">{form.primaryColor}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">نشط</label>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveMarket}>حفظ</Button>
              <Button variant="outline" onClick={() => setCreating(false)}>إلغاء</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {markets.map((m) => (
          <MarketCard
            key={m.id}
            market={m}
            isRootAdmin={isRootAdmin}
            canEdit={canEdit}
            onNavigate={() => navigate(`/markets/${m.id}`)}
            onAddAdmin={(e) => {
            e.stopPropagation();
            setAddAdminModal(m);
            setAddAdminEmail('');
          }}
          />
        ))}
      </div>

      {markets.length === 0 && !creating && (
        <p className="text-gray-500 py-8">لا توجد أسواق. اضغط &quot;إضافة سوق&quot; لإنشاء سوق.</p>
      )}

      <Modal
        open={!!addAdminModal}
        onClose={() => { setAddAdminModal(null); setAddAdminEmail(''); }}
        title="إضافة مسؤول سوق"
      >
        {addAdminModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">سوق: {addAdminModal.name}</p>
            <Input
              label="البريد الإلكتروني"
              type="email"
              value={addAdminEmail}
              onChange={(e) => setAddAdminEmail(e.target.value)}
              placeholder="admin@example.com"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddAdminModal(null)}>إلغاء</Button>
              <Button
                onClick={() => {
                  if (addAdminEmail.trim()) {
                    addAdminMutation.mutate({ marketId: addAdminModal.id, email: addAdminEmail.trim() });
                  }
                }}
                disabled={!addAdminEmail.trim() || addAdminMutation.isPending}
              >
                {addAdminMutation.isPending ? 'جاري...' : 'إضافة'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MarketCard({
  market,
  isRootAdmin,
  canEdit,
  onNavigate,
  onAddAdmin,
}: {
  market: Market;
  isRootAdmin: boolean;
  canEdit: boolean;
  onNavigate: () => void;
  onAddAdmin: (e: React.MouseEvent) => void;
}) {
  const { data: admins = [] } = useQuery({
    queryKey: ['market-admins', market.id],
    queryFn: () => apiFetch<User[]>(`/markets/${market.id}/admins`),
    enabled: isRootAdmin && !!market.id,
  });

  return (
    <Card
      className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onNavigate}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: market.branding?.primaryColor ?? '#7C3AED' }}
        >
          <Store className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{market.name}</h3>
          <p className="text-sm text-gray-500">/{market.slug}</p>
          <span className={`text-xs px-2 py-0.5 rounded ${market.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {market.isActive ? 'نشط' : 'غير نشط'}
          </span>
          {isRootAdmin && admins.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              مسؤولون: {admins.map((a) => a.email).join(', ')}
            </p>
          )}
        </div>
        {isRootAdmin && (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={onAddAdmin} disabled={!canEdit} title={canEdit ? 'إضافة مسؤول' : 'فعّل وضع الطوارئ'}>
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
