import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Modal, Button } from '@nmd/ui';
import { Gift, X, Copy } from 'lucide-react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useWinnerCoupon } from '../contexts/WinnerCouponContext';

const api = new MockApiClient();
const MODAL_SHOWN_KEY = 'nmd-winner-coupon-modal-shown';
const BANNER_DISMISSED_KEY = 'nmd-winner-coupon-banner-dismissed';

export default function WinnerCouponReminder() {
  const { customer } = useCustomerAuth();
  const { couponApplied } = useWinnerCoupon();
  const [modalOpen, setModalOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data: rewards = [] } = useQuery({
    queryKey: ['customer-rewards'],
    queryFn: () => api.getCustomerRewards(),
    enabled: !!customer,
  });

  const hasRewards = rewards.length > 0;
  const firstCode = rewards[0]?.code ?? '';

  useEffect(() => {
    if (!hasRewards) return;
    const alreadyShown = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(MODAL_SHOWN_KEY) === '1';
    if (!alreadyShown) setModalOpen(true);
  }, [hasRewards]);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    setBannerDismissed(sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1');
  }, []);

  const handleCopyAndUse = () => {
    if (firstCode) {
      navigator.clipboard.writeText(firstCode);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(MODAL_SHOWN_KEY, '1');
      setModalOpen(false);
    }
  };

  const handleCloseModal = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(MODAL_SHOWN_KEY, '1');
    setModalOpen(false);
  };

  const dismissBanner = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
    setBannerDismissed(true);
  };

  const copyFromBanner = () => {
    if (firstCode) navigator.clipboard.writeText(firstCode);
  };

  if (!hasRewards) return null;

  const showBanner = !bannerDismissed && !couponApplied;

  return (
    <>
      {/* Spacer so content is not hidden under fixed banner */}
      {showBanner && <div className="h-11 flex-shrink-0" aria-hidden />}
      {/* One-time congrats modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title="مبروك!"
        size="sm"
        zIndex={100000}
      >
        <div className="text-center" dir="rtl">
          <p className="text-gray-700 mb-2">
            🎉 مبروك! لديك كود خصم بانتظارك:
          </p>
          <p className="font-mono font-bold text-lg text-primary mb-4" dir="ltr">
            {firstCode}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            استخدمه عند إتمام الطلب في صفحة الدفع
          </p>
          <Button className="w-full gap-2" onClick={handleCopyAndUse}>
            <Copy className="w-4 h-4" />
            نسخ واستخدام
          </Button>
        </div>
      </Modal>

      {/* Sticky top banner (only when not dismissed) */}
      {showBanner && (
        <div
          className="fixed top-0 left-0 right-0 z-[99998] flex items-center justify-between gap-2 px-3 py-2 bg-amber-500 text-amber-950 shadow-md"
          role="banner"
          dir="rtl"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Gift className="w-5 h-5 shrink-0" aria-hidden />
            <span className="text-sm font-medium truncate">
              لديك كود خصم: <strong className="font-mono" dir="ltr">{firstCode}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!text-amber-950 hover:!bg-amber-600/30 !min-w-0 h-8 px-2"
              onClick={copyFromBanner}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <button
              type="button"
              onClick={dismissBanner}
              className="p-1.5 rounded hover:bg-amber-600/30 text-amber-950"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
