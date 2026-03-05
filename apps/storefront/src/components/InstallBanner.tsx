import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import {
  useIOSPWAInstallEligible,
  isIOS,
  isStandalone,
  PWA_INSTALL_DISMISS_KEY,
} from '../hooks/useIOSPWAInstallEligible';

/**
 * PWA Install Banner: shows on all routes (including deep links e.g. /store/buffalo).
 * iOS Safari: Install Guide bottom sheet, auto-shown on visit; re-shown after 24h if dismissed.
 */

/** Safari-style share icon (iOS share sheet). */
function SafariShareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function persistDismiss() {
  try {
    localStorage.setItem(PWA_INSTALL_DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** iOS-only premium bottom sheet for PWA install instructions. */
function IOSInstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[101] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-pwa-install-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              persistDismiss();
              onClose();
            }}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative w-full max-h-[88vh] bg-gradient-to-b from-white to-gray-50/80 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:max-w-md border border-gray-200/80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
              <h2
                id="ios-pwa-install-title"
                className="text-xl font-bold text-gray-900"
              >
                ثبّت تطبيق دبورية مول على هاتفك
              </h2>
              <button
                type="button"
                onClick={() => {
                  persistDismiss();
                  onClose();
                }}
                className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors -me-1"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pb-8 pt-2 overflow-auto flex-1">
              <div className="space-y-6">
                <div className="flex gap-4 items-start p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00A0A0] text-white font-bold text-lg shrink-0">
                    1
                  </span>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium text-base">
                      اضغط على زر المشاركة في أسفل المتصفح
                    </p>
                    <div className="mt-3 flex justify-center">
                      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 text-[#00A0A0] border-2 border-[#00A0A0]/30">
                        <SafariShareIcon className="w-7 h-7" />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00A0A0] text-white font-bold text-lg shrink-0">
                    2
                  </span>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium text-base">
                      اختر &quot;إضافة للشاشة الرئيسية&quot; (Add to Home Screen)
                    </p>
                  </div>
                </div>
              </div>

              {/* Animated arrow pointing down toward Safari share button area */}
              <div className="mt-6 flex justify-center">
                <motion.div
                  className="flex flex-col items-center text-[#00A0A0]"
                  initial={{ opacity: 0.6, y: 0 }}
                  animate={{
                    opacity: 1,
                    y: [0, 6, 0],
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <span className="text-xs font-medium text-gray-500 mb-1">أسفل الشاشة</span>
                  <svg
                    className="w-10 h-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </svg>
                </motion.div>
              </div>
            </div>

            <div className="px-5 pb-6 pt-2 flex-shrink-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  persistDismiss();
                  onClose();
                }}
                className="w-full py-3.5 rounded-xl bg-[#00A0A0] text-white font-semibold text-base shadow-lg shadow-[#00A0A0]/25 hover:bg-[#008080] active:scale-[0.99] transition-all"
              >
                فهمت
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function InstallBanner() {
  const iosEligible = useIOSPWAInstallEligible();
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBar, setShowAndroidBar] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroidBar(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (iosEligible) setShowIosSheet(true);
  }, [iosEligible]);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowAndroidBar(false);
    setDeferredPrompt(null);
  };

  const handleAndroidDismiss = () => {
    setShowAndroidBar(false);
    persistDismiss();
  };

  return (
    <>
      {/* iOS: premium bottom sheet only */}
      <IOSInstallSheet open={showIosSheet} onClose={() => setShowIosSheet(false)} />

      {/* Android / Chrome: bottom bar */}
      {!isIOS() && showAndroidBar && (
        <div
          className="fixed bottom-0 start-0 end-0 z-[100] flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-t from-[#00A0A0] to-[#008080] text-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
          role="banner"
          aria-label="تثبيت التطبيق"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-white">N</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">ثبّت التطبيق للتجربة الأفضل</p>
              <p className="text-xs text-white/90 truncate">استخدم التطبيق دون متصفح</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {deferredPrompt ? (
              <button
                type="button"
                onClick={handleAndroidInstall}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-[#00A0A0] font-semibold text-sm shadow-md hover:bg-gray-100 active:scale-[0.98] transition-transform"
              >
                <Download className="w-4 h-4" />
                تثبيت
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleAndroidDismiss}
              className="p-2 rounded-lg text-white/80 hover:bg-white/20 hover:text-white transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
