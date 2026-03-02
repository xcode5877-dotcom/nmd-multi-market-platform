import { Calendar } from 'lucide-react';

export function AvailableSlotsPlaceholder() {
  return (
    <section
      className="mb-10 p-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50"
      dir="rtl"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">المواعيد المتاحة</h2>
      </div>
      <p className="text-gray-600">
        قريباً: حجز المواعيد مباشرة من الموقع
      </p>
    </section>
  );
}
