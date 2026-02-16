import { Link } from 'react-router-dom';

export default function OffersPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">العروض</h1>
      <div className="py-16 text-center rounded-xl bg-white border border-gray-200 shadow-sm">
        <p className="text-4xl mb-4">📦</p>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">لا توجد عروض الآن</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          قريباً ستجد هنا عروض المحلات. تابعنا أو تصفح المحلات للتسوق.
        </p>
        <Link to="/stores" className="text-[#D97706] font-medium hover:underline">
          تصفح المحلات ←
        </Link>
      </div>
      <Link to="/" className="inline-block mt-8 text-gray-500 hover:text-gray-700 text-sm">
        ← العودة للرئيسية
      </Link>
    </div>
  );
}
