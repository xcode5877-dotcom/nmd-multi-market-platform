import { Link } from 'react-router-dom';
import { formatMoney } from '@nmd/core';

export default function PricingPage() {
  const tiers = [
    { name: 'Starter', price: formatMoney(0), desc: 'For small stores', features: ['1 store', 'Basic features'] },
    { name: 'Business', price: formatMoney(49), desc: 'For growing teams', features: ['5 stores', 'All modules', 'API access'] },
    { name: 'Enterprise', price: 'Custom', desc: 'For scale', features: ['Unlimited', 'SSO', 'Dedicated support'] },
  ];
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-white mb-4">Pricing</h1>
      <p className="text-gray-400 mb-8">
        Simple, transparent pricing for every stage of growth.
      </p>
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-[#7C3AED]/50 transition-colors"
          >
            <p className="font-semibold text-white">{tier.name}</p>
            <p className="text-2xl font-bold text-[#7C3AED] mt-2">{tier.price}</p>
            <p className="text-sm text-gray-400 mt-1">{tier.desc}</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-300">
              {tier.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Link to="/" className="inline-block mt-8 text-[#7C3AED] hover:text-[#6d28d9]">
        ← Back to Home
      </Link>
    </div>
  );
}
