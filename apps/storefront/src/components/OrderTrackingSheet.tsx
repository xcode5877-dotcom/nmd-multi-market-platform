import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone } from 'lucide-react';

export interface PublicOrderForTracking {
  id: string;
  status?: string;
  total?: number;
  currency?: string;
  fulfillmentType?: string;
  createdAt?: string;
  assignedDriver?: { name: string; phone: string };
  [key: string]: unknown;
}

const STEPS_DELIVERY = [
  { key: 'received', label: 'تم استلام الطلب', icon: '🛒', statuses: ['PENDING', 'CONFIRMED'] },
  { key: 'preparing', label: 'جاري التحضير', icon: '🔥', statuses: ['PREPARING'] },
  { key: 'transit', label: 'في الطريق إليك', icon: '🚀', statuses: ['READY', 'OUT_FOR_DELIVERY'] },
  { key: 'delivered', label: 'تم التسليم', icon: '✅', statuses: ['DELIVERED', 'COMPLETED'] },
] as const;

const STEPS_PICKUP = [
  { key: 'received', label: 'تم استلام الطلب', icon: '🛒', statuses: ['PENDING', 'CONFIRMED'] },
  { key: 'preparing', label: 'جاري التحضير', icon: '🔥', statuses: ['PREPARING'] },
  { key: 'ready', label: 'جاهز للاستلام', icon: '📦', statuses: ['READY'] },
  { key: 'collected', label: 'تم الاستلام', icon: '✅', statuses: ['DELIVERED', 'COMPLETED'] },
] as const;

function getStepIndex(status: string | undefined, steps: readonly { statuses: readonly string[] }[]): number {
  if (!status) return 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].statuses.includes(status)) return i;
  }
  if (['CANCELED', 'CANCELLED'].includes(status)) return -1;
  return 0;
}

export interface OrderTrackingSheetProps {
  open: boolean;
  onClose: () => void;
  order: PublicOrderForTracking | null;
}

export function OrderTrackingSheet({ open, onClose, order }: OrderTrackingSheetProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const isDelivery = order?.fulfillmentType === 'DELIVERY';
  const STEPS = isDelivery ? STEPS_DELIVERY : STEPS_PICKUP;
  const stepIndex = getStepIndex(order?.status, STEPS);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تتبع الطلب"
        >
          {/* Glassmorphism backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative w-full max-h-[88vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col sm:max-w-md shadow-2xl border border-white/20"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.92) 100%)',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-black/5">
              <h2 className="text-xl font-bold text-gray-900" dir="rtl">
                تتبع الطلب
              </h2>
              {order && (
                <p className="text-sm text-gray-500 mt-1 font-mono" dir="ltr">
                  #{order.id.slice(0, 8)}
                </p>
              )}
            </div>

            <div className="p-5 overflow-auto flex-1 space-y-6">
              {!order ? (
                <p className="text-gray-500 text-center py-8" dir="rtl">
                  جاري تحميل الطلب...
                </p>
              ) : (
                <>
                  {/* Visual stepper */}
                  <div className="relative" dir="rtl">
                    <div className="flex justify-between items-start gap-1">
                      {STEPS.map((step, i) => {
                        const isActive = stepIndex >= i;
                        const isCurrent = stepIndex === i;
                        return (
                          <div key={step.key} className="flex flex-col items-center flex-1">
                            <motion.div
                              initial={false}
                              animate={{
                                scale: isCurrent ? 1.15 : 1,
                                opacity: isActive ? 1 : 0.4,
                              }}
                              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border-2 ${
                                isActive
                                  ? 'bg-primary/15 border-primary/40 text-primary'
                                  : 'bg-gray-100 border-gray-200 text-gray-400'
                              }`}
                            >
                              {step.icon}
                            </motion.div>
                            <span
                              className={`text-xs mt-2 text-center font-medium ${
                                isActive ? 'text-gray-800' : 'text-gray-400'
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Progress bar under icons */}
                    <div className="mt-4 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={false}
                        animate={{ width: `${Math.max(0, (stepIndex / (STEPS.length - 1)) * 100)}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        style={{ originX: 0 }}
                      />
                    </div>
                  </div>

                  {/* Driver card — only for DELIVERY; hidden for PICKUP */}
                  {isDelivery && order.assignedDriver && (order.assignedDriver.name || order.assignedDriver.phone) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-lg">
                          🚗
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900" dir="rtl">
                            {order.assignedDriver.name || 'السائق'}
                          </p>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-lg bg-primary/20 text-primary text-xs font-medium">
                            في الطريق إليك!
                          </span>
                        </div>
                        {order.assignedDriver.phone && (
                          <a
                            href={`tel:${order.assignedDriver.phone.replace(/\D/g, '').replace(/^0/, '972')}`}
                            className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity"
                            aria-label="اتصال بالسائق"
                          >
                            <Phone className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Order summary */}
                  <div className="rounded-2xl bg-gray-50/80 border border-gray-100 p-4">
                    <p className="text-sm text-gray-500 mb-1" dir="rtl">
                      المبلغ الإجمالي
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {order.total != null && order.currency
                        ? `${order.total} ${order.currency}`
                        : '—'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
