import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'start' | 'end';
  /** Applied to the drawer panel (e.g. w-full max-w-full md:max-w-sm for full width on mobile) */
  contentClassName?: string;
}

export function Drawer({ open, onClose, title, children, side = 'end', contentClassName }: DrawerProps) {
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

  const isRtl = document.documentElement.dir === 'rtl';
  const fromStart = side === 'start';
  const fromEnd = side === 'end';

  const xOffset = fromStart
    ? isRtl
      ? '100%'
      : '-100%'
    : fromEnd
      ? isRtl
        ? '-100%'
        : '100%'
      : '100%';

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex"
          style={{ justifyContent: fromStart ? 'flex-start' : 'flex-end' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'drawer-title' : undefined}
        >
          {/* Full-screen backdrop: dims everything including sidebar and navbar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-[9998] bg-black/50"
            aria-hidden
          />
          <motion.div
            initial={{ x: xOffset }}
            animate={{ x: 0 }}
            exit={{ x: xOffset }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`relative z-[9999] w-full max-w-full md:max-w-md bg-white shadow-2xl max-h-screen h-full flex flex-col ${contentClassName ?? ''}`.trim()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
              {title && (
                <h2 id="drawer-title" className="text-lg font-semibold">
                  {title}
                </h2>
              )}
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-4 pb-20">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
