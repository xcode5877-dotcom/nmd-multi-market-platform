import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { Store, Loader2 } from 'lucide-react';

const api = new MockApiClient();

type Status = 'open' | 'closed' | 'busy';

const STATUS_LABELS: Record<Status, string> = {
  open: 'مفتوح لاستقبال الطلبات',
  busy: 'مشغول',
  closed: 'مغلق مؤقتاً',
};

const STATUS_COLORS: Record<Status, string> = {
  open: 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600',
  busy: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600',
  closed: 'bg-red-500 hover:bg-red-600 text-white border-red-600',
};

interface StoreStatusToggleProps {
  tenantId: string;
  currentStatus: Status | undefined;
  /** When status is closed, add extra visual emphasis (e.g. ring or banner) */
  emphasizeClosed?: boolean;
  /** Compact = inline buttons; full = with label "حالة المتجر" */
  variant?: 'compact' | 'full';
}

export default function StoreStatusToggle({
  tenantId,
  currentStatus = 'open',
  emphasizeClosed = true,
  variant = 'full',
}: StoreStatusToggleProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const status = currentStatus ?? 'open';
  const isClosed = status === 'closed';

  const updateMutation = useMutation({
    mutationFn: (newStatus: Status) =>
      api.updateOperationalSettingsApi(tenantId, { operationalStatus: newStatus }),
    onSuccess: async (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      await queryClient.refetchQueries({ queryKey: ['tenant-by-id', tenantId] });
      addToast(`تم تغيير حالة المتجر إلى ${STATUS_LABELS[newStatus]}`, 'success');
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل تحديث الحالة', 'error');
    },
  });

  return (
    <div
      className={`rounded-xl border-2 ${isClosed && emphasizeClosed ? 'border-red-300 bg-red-50/80' : 'border-gray-200 bg-white'} p-3`}
      dir="rtl"
    >
      {variant === 'full' && (
        <div className="flex items-center gap-2 mb-2">
          <Store className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-semibold text-gray-800">حالة المتجر</span>
          {isClosed && (
            <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">
              المتجر مغلق — العملاء لا يستطيعون إضافة طلبات
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {(['open', 'busy', 'closed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate(s)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
              ${status === s ? STATUS_COLORS[s] : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}
              disabled:opacity-60 disabled:cursor-not-allowed
            `}
          >
            {updateMutation.isPending && updateMutation.variables === s ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  status === s ? (s === 'open' ? 'bg-white' : 'bg-white/80') : 'bg-gray-400'
                }`}
              />
            )}
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
