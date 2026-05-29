import { Modal, Button, Input } from '@nmd/ui';
import { AlertTriangle } from 'lucide-react';
import { useEmergencyMode } from '../../contexts/EmergencyModeContext';
import type { GlobalCourierRow } from '../../drivers/globalCourierTypes';

export function CourierDeleteConfirmModal({
  courier,
  open,
  cascade,
  onCascadeChange,
  onClose,
  onConfirm,
  isPending,
  error,
  canWrite,
  isRootAdmin,
}: {
  courier: GlobalCourierRow | null;
  open: boolean;
  cascade: boolean;
  onCascadeChange: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error: string | null;
  canWrite: boolean;
  isRootAdmin: boolean;
}) {
  const emergency = useEmergencyMode();
  const emergencyReason = (emergency?.reason ?? '').trim();
  const rootReasonReady = !isRootAdmin || emergencyReason.length > 0;
  const canConfirmDelete = canWrite && rootReasonReady && !isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`حذف السائق — ${courier?.name ?? ''}`}
      size="sm"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            منطقة الخطر
          </p>
          <ul className="mt-2 space-y-1.5 list-disc list-inside text-red-800">
            <li>
              سيتم <strong>حذف حساب السائق</strong> نهائياً ولا يمكن التراجع عنه.
            </li>
            <li>
              الطلبات والسجل التاريخي: بدون الحذف الشامل تبقى الطلبات في النظام ويُزال ربط السائق فقط؛
              مع تفعيل الحذف الشامل تُحذف الطلبات والمدفوعات والمصاريف المرتبطة.
            </li>
          </ul>
          <p className="mt-2 text-red-700">
            يُفضّل <strong>تعطيل</strong> السائق بدلاً من الحذف إذا أردت الإبقاء على السجل دون حذف بيانات.
          </p>
        </div>

        {isRootAdmin && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-800">
              سبب التعديل (وضع الطوارئ) — مطلوب قبل الحذف
            </label>
            <Input
              placeholder="مثال: إنهاء تعاقد السائق — طلب الإدارة"
              value={emergency?.reason ?? ''}
              onChange={(e) => emergency?.toggle(e.target.value)}
            />
            {!rootReasonReady && (
              <p className="text-xs text-amber-800">أدخل سبباً لتفعيل وضع الطوارئ ثم أكّد الحذف.</p>
            )}
            {rootReasonReady && emergency?.enabled && (
              <p className="text-xs text-gray-500">سيُسجَّل هذا السبب في سجل التدقيق مع عملية الحذف.</p>
            )}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={cascade}
            onChange={(e) => onCascadeChange(e.target.checked)}
          />
          <span>حذف السائق مع السجلات المرتبطة</span>
        </label>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            إلغاء
          </Button>
          <Button
            variant="outline"
            className="text-red-700 border-red-300 hover:bg-red-50"
            disabled={!canConfirmDelete}
            onClick={onConfirm}
          >
            {isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
