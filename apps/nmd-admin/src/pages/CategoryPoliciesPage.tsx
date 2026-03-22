import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input } from '@nmd/ui';
import { apiFetch } from '../api';
import { useEmergencyMode } from '../contexts/EmergencyModeContext';
import { Save, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export type CategoryPolicy = {
  id: string;
  name: string;
  greenMs: number;
  orangeMs: number;
  redMs: number;
  isUrgent: boolean;
};

function msToMin(ms: number): number {
  return Math.round(ms / 60000);
}
function minToMs(m: number): number {
  return m * 60 * 1000;
}

export default function CategoryPoliciesPage() {
  const queryClient = useQueryClient();
  const emergency = useEmergencyMode();
  const canWrite = !!emergency?.enabled && !!emergency?.reason?.trim();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['category-policies'],
    queryFn: () => apiFetch<CategoryPolicy[]>('/category-policies'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CategoryPolicy> }) =>
      apiFetch<CategoryPolicy>(`/category-policies/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setSavingId(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['category-policies'] });
    },
    onError: (err: Error) => {
      setSavingId(null);
      setError(err.message ?? 'فشل الحفظ');
    },
  });

  const handleSave = (policy: CategoryPolicy, updates: { name?: string; greenMin?: number; orangeMin?: number; redMin?: number; isUrgent?: boolean }) => {
    setError(null);
    setSavingId(policy.id);
    const payload: Partial<CategoryPolicy> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.greenMin !== undefined) payload.greenMs = minToMs(updates.greenMin);
    if (updates.orangeMin !== undefined) payload.orangeMs = minToMs(updates.orangeMin);
    if (updates.redMin !== undefined) payload.redMs = minToMs(updates.redMin);
    if (updates.isUrgent !== undefined) payload.isUrgent = updates.isUrgent;
    updateMutation.mutate({ id: policy.id, payload });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">سياسات SLA حسب التصنيف</h1>
      <p className="text-sm text-gray-600 mb-6">
        حدد الدقائق (أخضر / برتقالي / أحمر) لكل تصنيف. لوحة الطلبات وتطبيق السائق يستخدمان هذه القيم.
      </p>
      {!canWrite && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          فعّل وضع الطوارئ واكتب السبب في الشريط العلوي لتعديل السياسات.
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}
      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 px-3 font-medium text-gray-700">التصنيف</th>
              <th className="py-2 px-3 font-medium text-gray-700">أخضر (د)</th>
              <th className="py-2 px-3 font-medium text-gray-700">برتقالي (د)</th>
              <th className="py-2 px-3 font-medium text-gray-700">أحمر (د)</th>
              <th className="py-2 px-3 font-medium text-gray-700">عاجل</th>
              <th className="py-2 px-3 font-medium text-gray-700">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <PolicyRow
                key={policy.id}
                policy={policy}
                canWrite={canWrite}
                saving={savingId === policy.id}
                onSave={handleSave}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PolicyRow({
  policy,
  canWrite,
  saving,
  onSave,
}: {
  policy: CategoryPolicy;
  canWrite: boolean;
  saving: boolean;
  onSave: (policy: CategoryPolicy, updates: { name?: string; greenMin?: number; orangeMin?: number; redMin?: number; isUrgent?: boolean }) => void;
}) {
  const [name, setName] = useState(policy.name);
  const [greenMin, setGreenMin] = useState(msToMin(policy.greenMs));
  const [orangeMin, setOrangeMin] = useState(msToMin(policy.orangeMs));
  const [redMin, setRedMin] = useState(msToMin(policy.redMs));
  const [isUrgent, setIsUrgent] = useState(policy.isUrgent);
  const [dirty, setDirty] = useState(false);

  const save = () => {
    onSave(policy, { name, greenMin, orangeMin, redMin, isUrgent });
    setDirty(false);
  };

  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 px-3">
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
          disabled={!canWrite}
          className="max-w-[180px]"
        />
      </td>
      <td className="py-2 px-3">
        <Input
          type="number"
          min={0}
          value={greenMin}
          onChange={(e) => { setGreenMin(Number(e.target.value) || 0); setDirty(true); }}
          disabled={!canWrite}
          className="w-20"
        />
      </td>
      <td className="py-2 px-3">
        <Input
          type="number"
          min={0}
          value={orangeMin}
          onChange={(e) => { setOrangeMin(Number(e.target.value) || 0); setDirty(true); }}
          disabled={!canWrite}
          className="w-20"
        />
      </td>
      <td className="py-2 px-3">
        <Input
          type="number"
          min={0}
          value={redMin}
          onChange={(e) => { setRedMin(Number(e.target.value) || 0); setDirty(true); }}
          disabled={!canWrite}
          className="w-20"
        />
      </td>
      <td className="py-2 px-3">
        <label className="flex items-center gap-2 justify-end">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => { setIsUrgent(e.target.checked); setDirty(true); }}
            disabled={!canWrite}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">نعم</span>
        </label>
      </td>
      <td className="py-2 px-3">
        {dirty && canWrite && (
          <Button
            size="sm"
            variant="primary"
            disabled={saving}
            onClick={save}
            className="gap-1.5"
          >
            {saving ? (
              'جاري...'
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                حفظ
              </>
            )}
          </Button>
        )}
      </td>
    </tr>
  );
}
