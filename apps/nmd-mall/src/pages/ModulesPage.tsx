import { Link } from 'react-router-dom';

const MODULES = ['Commerce', 'Restaurant', 'Apparel', 'Inventory', 'Analytics'];

export default function ModulesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-white mb-4">Modules</h1>
      <p className="text-gray-400 mb-8">
        Mix and match modules to fit your business needs.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {MODULES.map((name) => (
          <div
            key={name}
            className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-[#7C3AED]/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED] font-bold mb-3">
              {name.charAt(0)}
            </div>
            <h2 className="font-semibold text-white">{name}</h2>
            <p className="text-sm text-gray-400 mt-1">Module description placeholder</p>
          </div>
        ))}
      </div>
      <Link to="/" className="inline-block mt-8 text-[#7C3AED] hover:text-[#6d28d9]">
        ← Back to Home
      </Link>
    </div>
  );
}
