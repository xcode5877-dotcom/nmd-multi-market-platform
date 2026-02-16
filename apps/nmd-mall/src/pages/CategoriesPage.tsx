import { Link } from 'react-router-dom';

const CATEGORIES = [
  { id: 'food', label: 'طعام' },
  { id: 'clothes', label: 'ملابس' },
  { id: 'electronics', label: 'إلكترونيات' },
  { id: 'home', label: 'منزل' },
];

export default function CategoriesPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">الفئات</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            to={`/search?q=${encodeURIComponent(c.label)}`}
            className="p-6 rounded-xl bg-white border border-gray-200 hover:border-[#D97706]/50 hover:shadow-md transition-all text-center font-semibold text-gray-900"
          >
            {c.label}
          </Link>
        ))}
      </div>
      <Link to="/" className="inline-block mt-8 text-[#D97706] hover:underline">← العودة للرئيسية</Link>
    </div>
  );
}
