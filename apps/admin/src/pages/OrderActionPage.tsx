import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MockApiClient } from '@nmd/mock';
import type { Order } from '@nmd/core';

const api = new MockApiClient();

const ACTION_TO_STATUS: Record<string, Order['status']> = {
  confirm: 'CONFIRMED',
  ready: 'READY',
  shipped: 'COMPLETED',
};

export default function OrderActionPage() {
  const { orderId, action } = useParams<{ orderId: string; action: string }>();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || !action) {
      setState('error');
      setErrorMessage('رابط غير صالح');
      return;
    }
    const status = ACTION_TO_STATUS[action.toLowerCase()];
    if (!status) {
      setState('error');
      setErrorMessage('إجراء غير معروف');
      return;
    }

    let cancelled = false;
    api
      .updateOrderStatus(orderId, status)
      .then((updated) => {
        if (cancelled) return;
        if (updated) {
          setState('success');
        } else {
          setState('error');
          setErrorMessage('لم يتم العثور على الطلب أو لا يمكن تحديثه');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setState('error');
        setErrorMessage(err?.message ?? 'حدث خطأ أثناء تحديث الحالة');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, action]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50" dir="rtl">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
        <p className="mt-4 text-gray-600">جاري تحديث حالة الطلب...</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <p className="text-red-600 font-medium mb-4">{errorMessage}</p>
          <Link
            to="/orders"
            className="inline-block px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90"
          >
            العودة إلى الطلبات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl" aria-hidden>✓</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">تم تحديث حالة الطلب</h1>
        <p className="text-gray-600 mb-6">تم حفظ التغيير بنجاح.</p>
        <Link
          to="/orders"
          className="inline-block px-5 py-2.5 rounded-lg bg-primary text-white font-medium hover:opacity-90"
        >
          العودة إلى الطلبات
        </Link>
        <p className="mt-4">
          <Link to="/" className="text-sm text-gray-500 hover:underline">لوحة التحكم</Link>
        </p>
      </div>
    </div>
  );
}
