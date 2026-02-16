import { Link } from 'react-router-dom';

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-white mb-2">Login</h1>
      <p className="text-gray-400 text-sm mb-8">Sign in to NMD OS Control</p>
      <div className="p-6 rounded-xl bg-white/5 border border-white/10">
        <form className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              className="w-full px-4 py-2 rounded-lg bg-[#1E293B] border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-2 rounded-lg bg-[#1E293B] border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>
          <button
            type="button"
            className="w-full py-3 rounded-xl bg-[#7C3AED] text-white font-semibold hover:bg-[#6d28d9] transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
      <Link to="/" className="inline-block mt-6 text-[#7C3AED] hover:text-[#6d28d9] text-sm">
        ← Back to Home
      </Link>
    </div>
  );
}
