import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../contexts/NativeBridgeContext';
import { CourierAttendancePanel } from '../components/CourierAttendancePanel';
import { ArrowRight } from 'lucide-react';

/**
 * Route /earnings kept for backward compatibility.
 * Business contract: this page is attendance (الدوام), not driver personal income.
 */
export default function CourierEarningsPage() {
  const { user } = useAuth();
  const { isNativeApp } = useNativeBridge();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {!isNativeApp && (
        <header className="bg-teal-600 text-white px-4 py-4 shadow">
          <Link to="/" className="text-sm text-teal-100 mb-1 inline-flex items-center gap-1">
            <ArrowRight className="w-4 h-4 rotate-180" />
            الرئيسية
          </Link>
          <h1 className="text-xl font-bold">الدوام</h1>
          <p className="text-xs text-teal-100 mt-1">ساعات العمل فقط — بدون راتب أو أرباح شخصية</p>
        </header>
      )}

      <div className="p-4 max-w-md mx-auto space-y-4">
        <CourierAttendancePanel enabled={!!user.courierId} defaultPeriod="all" />

        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">تنويه ملكية الأموال</p>
          <p>دخل طلبات التطبيق والطلبات الخارجية ملك للشركة.</p>
          <p>النقد المحصّل عند التسليم عهدة لصالح الشركة وليس دخلاً للسائق.</p>
        </div>

        <Link
          to="/expenses"
          className="block text-center text-sm text-teal-700 font-medium py-2"
        >
          تسجيل مصروف تشغيلي ←
        </Link>
      </div>
    </div>
  );
}
