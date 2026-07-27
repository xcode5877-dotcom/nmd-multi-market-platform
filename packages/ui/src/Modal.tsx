import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './Button';
import { lockBodyScroll, unlockBodyScroll } from './body-scroll-lock';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Use for stacking above drawers (Drawer is z-9999). Default keeps modals above drawers. */
  zIndex?: number;
}

const DEFAULT_MODAL_Z_INDEX = 10050;

export function Modal({ open, onClose, title, children, size = 'md', zIndex = DEFAULT_MODAL_Z_INDEX }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (!open) return undefined;
    document.addEventListener('keydown', handleEscape);
    lockBodyScroll();
    return () => {
      document.removeEventListener('keydown', handleEscape);
      unlockBodyScroll();
    };
  }, [open, onClose]);

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          key="nmd-modal-root"
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          <motion.div
            key="nmd-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
          />
          <motion.div
            key="nmd-modal-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`relative flex flex-col w-full max-h-[90vh] ${sizes[size]} bg-white rounded-[var(--radius)] shadow-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between flex-shrink-0 p-4 border-b border-gray-200">
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold">
                  {title}
                </h2>
              )}
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto min-h-0">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
