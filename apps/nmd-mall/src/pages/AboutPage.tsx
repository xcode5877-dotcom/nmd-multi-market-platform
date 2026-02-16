import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">عن سوق دبورية الرقمي</h1>

      <div className="space-y-10">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">لماذا أطلقنا السوق؟</h2>
          <p className="text-gray-700 leading-relaxed">
            أردنا أن يكون لأهل دبورية مكان واحد يجمع كل المحلات والتجار المحليين. سوق يفيد المشتري ويفتح فرصاً للتاجر — بدون تعقيد، وبأسلوب يناسب قرينا.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">رؤيتنا</h2>
          <p className="text-gray-700 leading-relaxed">
            نريد سوقاً رقمياً يجمع دبورية — كل محلاتك وطلباتك في مكان واحد. تسوق بسهولة، ادعم جيرانك، وابنِ معنا مجتمعاً أقوى.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">دعم المشاريع المحلية</h2>
          <p className="text-gray-700 leading-relaxed">
            كل طلب من السوق يذهب لمحلات دبورية. نؤمن بالمشاريع المحلية وندعم التجار بإيجاد زبائن جدد ووصول أسهل.
          </p>
        </section>

        <section className="pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            يعمل السوق بتقنية <span className="font-medium text-gray-700">NMD OS</span>
          </p>
        </section>
      </div>

      <Link to="/" className="inline-block mt-10 text-[#D97706] hover:underline">
        ← العودة للرئيسية
      </Link>
    </div>
  );
}
