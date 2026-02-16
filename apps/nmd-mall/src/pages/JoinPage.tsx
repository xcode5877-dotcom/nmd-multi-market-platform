import { Link } from 'react-router-dom';
import { Store, LayoutDashboard, Users } from 'lucide-react';

export default function JoinPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">أضف محلك إلى سوق دبورية</h1>
      <p className="text-gray-600 text-center mb-10">
        انضم للتجار المحليين ووصل لزبائن أكثر
      </p>

      <div className="space-y-6 mb-10">
        <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#D97706] shrink-0">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">فوائد الانضمام</h2>
            <p className="text-gray-600 text-sm">
              ظهور محلك في سوق واحد يجمع زبائن القرية، وعدد أكبر من الطلبات من جيرانك.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#D97706] shrink-0">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">سهولة الإدارة</h2>
            <p className="text-gray-600 text-sm">
              إدارة منتجاتك وطلباتك من لوحة بسيطة — بدون تعقيد تقني.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#D97706] shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">وصول لزبائن أكثر</h2>
            <p className="text-gray-600 text-sm">
              يوصل السوق زبائن جدد لمحلك — أهل القرية يبحثون هنا عن كل شيء.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link
          to="/contact"
          className="inline-block px-8 py-3 rounded-xl bg-[#D97706] text-white font-semibold hover:bg-[#B45309] transition-colors"
        >
          تواصل معنا
        </Link>
      </div>

      <Link to="/" className="inline-block mt-10 text-[#D97706] hover:underline">
        ← العودة للرئيسية
      </Link>
    </div>
  );
}
