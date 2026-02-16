import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const MARKET_ADMIN_LOGIN_URL = 'http://localhost:5176/login';
/** Shown when MARKET_ADMIN (or other non-tenant role) logs into tenant-admin (5174). TENANT_ADMIN stays and proceeds. */
const WRONG_ROLE_MSG = 'لديك صلاحيات مسؤول السوق. استخدم لوحة إدارة السوق (5176).';

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
  const { login, logout, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'));

  useEffect(() => {
    if (!token || !MOCK_API_URL) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${MOCK_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const me = (await res.json()) as { role?: string; tenantId?: string };
        if (cancelled) return;
        if (me.role !== 'TENANT_ADMIN') {
          logout();
          setError(WRONG_ROLE_MSG);
          return;
        }
        if (me.tenantId) {
          const tenantRes = await fetch(`${MOCK_API_URL}/tenants/by-id/${me.tenantId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (tenantRes.ok) {
            const tenant = (await tenantRes.json()) as { slug?: string };
            navigate(`/?tenant=${encodeURIComponent(tenant.slug ?? me.tenantId)}`, { replace: true });
            return;
          }
        }
        navigate(returnTo ?? '/', { replace: true });
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [token, returnTo, navigate, logout]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      const res = await fetch(`${MOCK_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('nmd-access-token')}` },
      });
      if (!res.ok) throw new Error('Failed to fetch user');
      const me = (await res.json()) as { role?: string; tenantId?: string };
      if (me.role !== 'TENANT_ADMIN') {
        logout();
        setError(WRONG_ROLE_MSG);
        return;
      }
      if (me.tenantId) {
        const tenantRes = await fetch(`${MOCK_API_URL}/tenants/by-id/${me.tenantId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('nmd-access-token')}` },
        });
        if (tenantRes.ok) {
          const tenant = (await tenantRes.json()) as { slug?: string };
          navigate(`/?tenant=${encodeURIComponent(tenant.slug ?? me.tenantId)}`, { replace: true });
          return;
        }
      }
      navigate(returnTo ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  if (token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
      <div className="w-full max-w-sm p-6 bg-[#1E293B] rounded-xl border border-[#334155] shadow-xl">
        <h1 className="text-xl font-bold text-white text-center mb-6">تسجيل دخول المتجر</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[#334155] text-white rounded-lg border border-[#475569] focus:border-[#7C3AED] focus:outline-none"
              placeholder="ms-brands@nmd.com"
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
          {error && (
            <div className="space-y-2">
              <p className="text-red-400 text-sm">{error}</p>
              {error === WRONG_ROLE_MSG && (
                <a
                  href={MARKET_ADMIN_LOGIN_URL}
                  className="block w-full py-2 text-center text-sm text-[#7C3AED] hover:text-[#6D28D9] border border-[#7C3AED] rounded-lg transition-colors"
                >
                  اذهب إلى لوحة إدارة السوق (5176)
                </a>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>
        <p className="mt-4 text-xs text-gray-500 text-center">
          البريد: &lt;tenantSlug&gt;@nmd.com — كلمة المرور: &lt;tenantSlug&gt;@2026
        </p>
      </div>
    </div>
  );
}
