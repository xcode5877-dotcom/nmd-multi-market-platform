import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import {
  useIOSPWAInstallEligible,
  isIOS,
  isStandalone,
} from '../hooks/useIOSPWAInstallEligible';
import { useNativeBridge } from '../contexts/NativeBridgeContext';

const IOS_A2HS_DONT_SHOW_KEY = 'nmd-ios-a2hs-dont-show';

function getA2HSDontShow(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(IOS_A2HS_DONT_SHOW_KEY) === '1';
}

function setA2HSDontShow(): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(IOS_A2HS_DONT_SHOW_KEY, '1');
}

/**
 * PWA Install Banner:
 * - iOS Safari: subtle bottom bar with Share icon + arrow; tap opens full-screen overlay with 3-step instructions. "Don't show again" persisted in localStorage.
 * - Android/Chrome: bottom bar with install button when beforeinstallprompt fires.
 */

/** Official iOS Share icon (Safari bottom bar). */
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

/** iOS full-screen overlay: 3-step A2HS instructions, native-style blur + rounded. */
function IOSInstallSheet({
  open,
  onClose,
  onDontShowAgain,
}: {
  open: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
}) {
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
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative w-full max-h-[90vh] bg-white/90 backdrop-blur-xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col sm:max-w-md border border-white/20"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
              <h2 id="ios-pwa-install-title" className="text-xl font-bold text-gray-900">
                أضف التطبيق إلى الشاشة الرئيسية
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100/80 transition-colors -me-1"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pb-4 pt-2 overflow-auto flex-1">
              <div className="space-y-4">
                <div className="flex gap-4 items-start p-4 rounded-2xl bg-gray-100/60 backdrop-blur-sm border border-gray-200/60">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00A0A0] text-white font-bold text-lg shrink-0">1</span>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium text-base">
                      اضغط على زر <strong>المشاركة</strong> في الشريط السفلي
                    </p>
                    <div className="mt-3 flex justify-center">
                      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/80 border-2 border-[#00A0A0]/30 text-[#00A0A0] shadow-sm">
                        <SafariShareIcon className="w-7 h-7" />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-4 rounded-2xl bg-gray-100/60 backdrop-blur-sm border border-gray-200/60">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00A0A0] text-white font-bold text-lg shrink-0">2</span>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium text-base">
                      مرّر للأسفل واختر &quot;<strong>إضافة إلى الشاشة الرئيسية</strong>&quot;
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-4 rounded-2xl bg-gray-100/60 backdrop-blur-sm border border-gray-200/60">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#00A0A0] text-white font-bold text-lg shrink-0">3</span>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium text-base">
                      اضغط &quot;<strong>إضافة</strong>&quot; في أعلى اليمين
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 pb-2 flex-shrink-0 space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-[#00A0A0] text-white font-semibold text-base shadow-lg active:scale-[0.99] transition-transform"
              >
                فهمت
              </button>
              <button
                type="button"
                onClick={() => {
                  onDontShowAgain();
                  onClose();
                }}
                className="w-full py-2.5 rounded-2xl text-gray-500 text-sm font-medium hover:bg-gray-100/80 active:bg-gray-200/60 transition-colors"
              >
                لا تُظهر مرة أخرى
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function InstallBanner() {
  const { isNativeApp } = useNativeBridge();
  const iosEligible = useIOSPWAInstallEligible();
  const [showIosBar, setShowIosBar] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [_iosDontShow, setIosDontShow] = useState(true);
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
    setIosDontShow(getA2HSDontShow());
  }, []);

  useEffect(() => {
    if (iosEligible && !getA2HSDontShow()) setShowIosBar(true);
    else setShowIosBar(false);
  }, [iosEligible]);

  const handleIosDontShowAgain = () => {
    setA2HSDontShow();
    setIosDontShow(true);
    setShowIosBar(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowAndroidBar(false);
    setDeferredPrompt(null);
  };

  const handleAndroidDismiss = () => setShowAndroidBar(false);

  if (isNativeApp) return null;

  return (
    <>
      {/* iOS: bottom bar prompt (Share icon + arrow); tap opens full-screen overlay */}
      {showIosBar && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none sm:pointer-events-auto"
        >
          <button
            type="button"
            onClick={() => setShowIosSheet(true)}
            className="pointer-events-auto flex flex-col items-center gap-1 rounded-2xl bg-white/85 backdrop-blur-xl border border-white/40 shadow-lg shadow-black/10 px-6 py-4 active:scale-[0.98] transition-transform"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
            aria-label="كيفية إضافة التطبيق إلى الشاشة الرئيسية"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-100/90 text-gray-700 border border-gray-200/80">
                <SafariShareIcon className="w-6 h-6" />
              </span>
              <span className="text-sm font-medium text-gray-700">أضف إلى الشاشة الرئيسية</span>
            </div>
            <span className="text-xs text-gray-500">اضغط للتعليمات</span>
            <motion.span
              className="text-[#00A0A0]"
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </motion.span>
          </button>
        </motion.div>
      )}

      <IOSInstallSheet
        open={showIosSheet}
        onClose={() => setShowIosSheet(false)}
        onDontShowAgain={handleIosDontShowAgain}
      />

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
