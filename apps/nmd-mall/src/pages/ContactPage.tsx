import { Link } from 'react-router-dom';

export default function ContactPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">تواصل معنا</h1>
      <p className="text-gray-600 mb-8">للتواصل مع فريق سوق دبورية الرقمي — قريباً</p>
      <Link to="/" className="text-[#D97706] hover:underline">← العودة للرئيسية</Link>
    </div>
  );
}
