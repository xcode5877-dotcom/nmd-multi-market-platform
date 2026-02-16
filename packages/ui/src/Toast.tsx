import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('ToastProvider required');
  return ctx;
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID?.() ?? `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20',
  error: 'bg-red-600 text-white shadow-lg shadow-red-900/20',
  info: 'bg-gray-800 text-white shadow-lg',
};

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-4 start-4 z-[100] flex flex-col gap-2"
      style={{ direction: 'ltr' }}
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 min-w-[200px] ${VARIANT_STYLES[t.variant ?? 'info']}`}
          >
            {t.variant === 'success' && (
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">✓</span>
            )}
            {t.variant === 'error' && (
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">!</span>
            )}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => onRemove(t.id)}
              className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
              aria-label="إغلاق"
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export { ToastProvider };
