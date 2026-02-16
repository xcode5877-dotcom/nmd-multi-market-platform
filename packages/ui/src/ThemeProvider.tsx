import { createContext, useContext, useEffect, useMemo } from 'react';
import type { TenantBranding } from '@nmd/core';
import { tenantBrandingToCssVars } from '@nmd/core';

interface ThemeContextValue {
  branding: TenantBranding;
  layoutStyle: TenantBranding['layoutStyle'];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('ThemeProvider required');
  return ctx;
}

interface ThemeProviderProps {
  branding: TenantBranding;
  dir?: 'ltr' | 'rtl';
  children: React.ReactNode;
}

export function ThemeProvider({ branding, dir = 'rtl', children }: ThemeProviderProps) {
  const vars = useMemo(() => tenantBrandingToCssVars(branding), [branding]);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en';
  }, [dir]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value as string);
    });
  }, [vars]);

  const value = useMemo(() => ({ branding, layoutStyle: branding.layoutStyle }), [branding]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
