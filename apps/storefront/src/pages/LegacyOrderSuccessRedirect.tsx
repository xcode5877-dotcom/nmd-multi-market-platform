import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@nmd/ui';

/**
 * Handles legacy URL /order/:orderId/success (without tenant slug).
 * Redirects to home since we cannot resolve tenant from URL without auth.
 */
export default function LegacyOrderSuccessRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/', { replace: true }), 3000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="max-w-md mx-auto p-8 text-center min-h-[40vh] flex flex-col justify-center" dir="rtl">
      <p className="text-gray-600 mb-4">تم استلام طلبك. تم تحديث الرابط.</p>
      <p className="text-sm text-gray-500 mb-6">جاري التحويل للصفحة الرئيسية...</p>
      <Button onClick={() => navigate('/')}>العودة للتسوق</Button>
    </div>
  );
}
