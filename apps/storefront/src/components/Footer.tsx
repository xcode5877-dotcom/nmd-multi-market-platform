import { Link } from 'react-router-dom';
import { useAppStore } from '../store/app';

export function Footer() {
  const tenantName = useAppStore((s) => s.tenantName);
  const tenantSlug = useAppStore((s) => s.tenantSlug) ?? '';
  const base = tenantSlug ? `/${tenantSlug}` : '';
  const quickLinks: { label: string; to: string; external?: boolean }[] = [
    { label: 'الرئيسية', to: base || '/' },
    { label: 'السلة', to: tenantSlug ? `/${tenantSlug}/cart` : '/cart' },
    { label: 'تواصل', to: '#', external: true },
    { label: 'سياسة الخصوصية', to: '#', external: true },
  ];

  return (
    <footer
      className="mt-auto border-t border-neutral-200 bg-white"
      dir="rtl"
      role="contentinfo"
    >
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 pb-20 md:pb-8">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Quick links */}
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-1" aria-label="روابط سريعة">
            {quickLinks.map(({ label, to, external }) =>
              external ? (
                <a
                  key={label}
                  href={to}
                  className="text-sm font-medium text-neutral-600 hover:text-primary transition-colors"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={label}
                  to={to}
                  className="text-sm font-medium text-neutral-600 hover:text-primary transition-colors"
                >
                  {label}
                </Link>
              )
            )}
          </nav>

          {/* Trust line */}
          <p className="text-xs text-neutral-500">
            دفع آمن • توصيل سريع • استبدال سهل
          </p>

          {/* Copyright + optional tenant */}
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-xs text-neutral-400">
              © 2026 سوق دبورية الرقمي — جميع الحقوق محفوظة
            </p>
            {tenantName && (
              <p className="text-xs text-neutral-400/80">
                {tenantName}
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
