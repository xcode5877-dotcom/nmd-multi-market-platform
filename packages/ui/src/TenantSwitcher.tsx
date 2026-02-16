import { useState } from 'react';
import { Store } from 'lucide-react';

export interface TenantOption {
  id: string;
  slug: string;
  name: string;
}

interface TenantSwitcherProps {
  tenants: TenantOption[];
  currentTenant: string;
  onSelect: (slugOrId: string) => void;
  className?: string;
  /** Set to false in production to hide. Pass import.meta.env.DEV from Vite apps. */
  visible?: boolean;
}

/**
 * Dev-only tenant switcher. Pass visible={import.meta.env.DEV} to hide in production.
 */
export function TenantSwitcher({ tenants, currentTenant, onSelect, className = '', visible = true }: TenantSwitcherProps) {
  const [open, setOpen] = useState(false);

  if (!visible) return null;

  const current = tenants.find((t) => t.slug === currentTenant || t.id === currentTenant);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Store className="w-4 h-4 text-gray-500" />
        <span>{current?.name ?? 'Select tenant'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            className="absolute top-full mt-1 end-0 z-50 min-w-[180px] py-1 bg-white border border-gray-200 rounded-lg shadow-lg"
          >
            {tenants.map((t) => (
              <li key={t.id} role="option">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(t.slug);
                    setOpen(false);
                  }}
                  className={`w-full text-start px-3 py-2 text-sm hover:bg-gray-100 ${
                    (t.slug === currentTenant || t.id === currentTenant) ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
