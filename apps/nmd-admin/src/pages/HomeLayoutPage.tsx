import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@nmd/ui';
import { apiFetch } from '../api';
import { GripVertical } from 'lucide-react';
import { useEmergencyMode } from '../contexts/EmergencyModeContext';
import { useAuth } from '../contexts/AuthContext';

type TenantRow = { id: string; name: string; slug?: string; enabled?: boolean; sortOrder?: number };

export default function HomeLayoutPage() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const emergency = useEmergencyMode();
  const canWrite =
    me?.role === 'SUPER_ADMIN' ||
    (!!emergency?.enabled && !!emergency?.reason?.trim());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: () => apiFetch<TenantRow[]>('/tenants'),
  });

  const updateTenantMutation = useMutation({
    mutationFn: ({ id, sortOrder }: { id: string; sortOrder: number }) =>
      apiFetch(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify({ sortOrder }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants-list'] }),
  });

  const sorted = [...tenants].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (!id) return;
      const fromIndex = sorted.findIndex((t) => t.id === id);
      if (fromIndex === -1) return;
      const reordered = [...sorted];
      const [removed] = reordered.splice(fromIndex, 1);
      reordered.splice(targetIndex, 0, removed);
      setDragId(null);
      setDropIndex(null);
      if (!canWrite) return;
      reordered.forEach((t, i) => {
        if ((t.sortOrder ?? 999) !== i) updateTenantMutation.mutate({ id: t.id, sortOrder: i });
      });
    },
    [sorted, canWrite, updateTenantMutation]
  );

  if (isLoading) return <div className="p-6 text-gray-500">جاري التحميل...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">ترتيب المتاجر (الصفحة الرئيسية)</h1>
      <p className="text-sm text-gray-600 mb-6">
        اسحب المتاجر لترتيب ظهورها في تطبيق العميل. الترتيب الحالي يظهر أدناه.
      </p>
      {!canWrite && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          فعّل وضع الطوارئ واكتب السبب في الشريط العلوي لتعديل الترتيب.
        </p>
      )}
      <Card className="p-4">
        <ul className="divide-y divide-gray-200">
          {sorted.map((t, index) => (
            <li
              key={t.id}
              draggable={canWrite}
              onDragStart={(e) => {
                if (!canWrite) return;
                setDragId(t.id);
                e.dataTransfer.setData('text/plain', t.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => { setDragId(null); setDropIndex(null); }}
              onDragOver={(e) => {
                if (!canWrite || !dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropIndex(index);
              }}
              onDrop={(e) => canWrite && handleDrop(e, index)}
              className={`flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg transition-colors ${
                dropIndex === index ? 'bg-primary/10' : ''
              } ${dragId === t.id ? 'opacity-60' : ''} ${canWrite ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              {canWrite && (
                <span className="text-gray-400 shrink-0" aria-hidden>
                  <GripVertical className="w-5 h-5" />
                </span>
              )}
              <span className="font-medium text-gray-900 flex-1">{t.name}</span>
              <span className="text-xs text-gray-500">{t.slug ?? t.id.slice(0, 8)}</span>
              <span className="text-xs text-gray-400">#{index + 1}</span>
            </li>
          ))}
        </ul>
        {sorted.length === 0 && (
          <p className="text-gray-500 py-8 text-center">لا متاجر حتى الآن.</p>
        )}
      </Card>
    </div>
  );
}
