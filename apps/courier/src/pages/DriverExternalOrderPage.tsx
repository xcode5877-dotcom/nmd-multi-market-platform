import { Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';

/** External orders are created by market dispatch — courier creation disabled (Phase 1). */
export default function DriverExternalOrderPage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-teal-600 text-white px-4 py-4 shadow">
        <Link to="/" className="text-sm text-teal-100 mb-1 inline-flex items-center gap-1">
          <ArrowRight className="w-4 h-4 rotate-180" />
          الرئيسية
        </Link>
        <h1 className="text-xl font-bold">طلب خارجي</h1>
      </header>

      <div className="p-4 max-w-md mx-auto">
        <div className="mt-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center">
            <Info className="w-7 h-7 text-teal-600" />
          </div>
          <p className="text-lg font-bold text-slate-900">الطلبات الخارجية يتم إنشاؤها من إدارة السوق</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            External orders are created by market dispatch. Contact your market admin to register an off-app delivery.
          </p>
          <Link
            to="/"
            className="inline-block mt-2 px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
