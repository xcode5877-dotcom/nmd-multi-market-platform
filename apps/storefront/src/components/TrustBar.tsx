import { Banknote, Truck, MessageCircle } from 'lucide-react';

const TRUST_ITEMS = [
  { icon: Banknote, label: 'دفع نقدي' },
  { icon: Truck, label: 'توصيل سريع' },
  { icon: MessageCircle, label: 'دعم واتساب' },
];

export function TrustBar() {
  return (
    <div className="bg-white border-b border-gray-100 py-2">
      <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-center gap-6 md:gap-10 text-sm text-gray-600">
        {TRUST_ITEMS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
