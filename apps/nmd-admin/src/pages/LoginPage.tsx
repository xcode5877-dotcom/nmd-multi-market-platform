import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function getSafeReturnTo(returnTo: string | null): string | null {
  if (!returnTo || typeof returnTo !== 'string') return null;
  const decoded = decodeURIComponent(returnTo);
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  return decoded;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, token, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'));

  useEffect(() => {
    if (!isLoading && token) {
      navigate(returnTo ?? '/', { replace: true });
    }
  }, [token, isLoading, navigate, returnTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(returnTo ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
      <div className="w-full max-w-sm p-6 bg-[#1E293B] rounded-xl border border-[#334155] shadow-xl">
        <h1 className="text-xl font-bold text-white text-center mb-6">NMD OS Control</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[#334155] text-white rounded-lg border border-[#475569] focus:border-[#7C3AED] focus:outline-none"
              placeholder="admin@nmd.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#334155] text-white rounded-lg border border-[#475569] focus:border-[#7C3AED] focus:outline-none"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
        <p className="mt-4 text-xs text-gray-500 text-center">
          root@nmd.com / dab@nmd.com / iks@nmd.com — كلمة المرور: 123456
        </p>
      </div>
    </div>
  );
}
