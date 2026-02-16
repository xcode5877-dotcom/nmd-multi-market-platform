import { Link } from 'react-router-dom';

export default function FeaturesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-white mb-4">Features</h1>
      <p className="text-gray-400 mb-8">
        NMD OS delivers modular commerce infrastructure built for scale.
      </p>
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h2 className="font-semibold text-white">Web-first</h2>
          <p className="text-sm text-gray-400">Run your entire business from the browser.</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h2 className="font-semibold text-white">API-ready</h2>
          <p className="text-sm text-gray-400">Integrate with your existing tools and workflows.</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h2 className="font-semibold text-white">Modular</h2>
          <p className="text-sm text-gray-400">Commerce, Restaurant, Apparel, Inventory, Analytics modules.</p>
        </div>
      </div>
      <Link to="/" className="inline-block mt-8 text-[#7C3AED] hover:text-[#6d28d9]">
        ← Back to Home
      </Link>
    </div>
  );
}
