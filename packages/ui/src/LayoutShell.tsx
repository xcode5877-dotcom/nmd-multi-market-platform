import { createContext, useContext } from 'react';
import type { TenantBranding } from '@nmd/core';
type LayoutStyle = TenantBranding['layoutStyle'];

const LAYOUT_CLASSES: Record<
  LayoutStyle,
  { header: string; card: string; section: string; button: string; badge: string }
> = {
  minimal: {
    header: 'border-b border-gray-200 bg-white',
    card: 'shadow-sm border border-gray-100 rounded-[var(--radius)]',
    section: 'space-y-4',
    button: 'rounded-sm',
    badge: 'rounded-sm bg-gray-100',
  },
  cozy: {
    header: 'shadow-sm bg-white rounded-b-2xl',
    card: 'shadow-md rounded-2xl shadow-gray-200/50',
    section: 'space-y-5',
    button: 'rounded-xl',
    badge: 'rounded-xl',
  },
  bold: {
    header: 'shadow-md bg-primary text-white',
    card: 'shadow-lg rounded-2xl border-2 border-primary/20',
    section: 'space-y-6',
    button: 'rounded-full font-bold',
    badge: 'rounded-full font-bold',
  },
  modern: {
    header: 'border-b-2 border-gray-900 bg-white',
    card: 'border border-gray-200 rounded-lg',
    section: 'space-y-4',
    button: 'rounded-md',
    badge: 'rounded-md',
  },
  default: {
    header: 'shadow-sm bg-white',
    card: 'shadow-md rounded-[var(--radius)]',
    section: 'space-y-4',
    button: 'rounded-[var(--radius)]',
    badge: 'rounded-full',
  },
  compact: {
    header: 'border-b border-gray-200 bg-white',
    card: 'shadow-sm border border-gray-100',
    section: 'space-y-2',
    button: 'rounded',
    badge: 'rounded',
  },
  spacious: {
    header: 'shadow-md bg-white',
    card: 'shadow-lg rounded-2xl',
    section: 'space-y-6',
    button: 'rounded-xl',
    badge: 'rounded-xl',
  },
};

const LayoutContext = createContext<LayoutStyle>('default');

export function useLayoutStyle(): LayoutStyle {
  try {
    const ctx = useContext(LayoutContext);
    return ctx ?? 'default';
  } catch {
    return 'default';
  }
}

export interface LayoutShellProps {
  layoutStyle?: LayoutStyle;
  children: React.ReactNode;
}

export function LayoutShell({ layoutStyle = 'default', children }: LayoutShellProps) {
  return (
    <LayoutContext.Provider value={layoutStyle}>
      <div data-layout-style={layoutStyle} className="layout-shell">
        {children}
      </div>
    </LayoutContext.Provider>
  );
}

export function layoutHeaderClass(layoutStyle: LayoutStyle): string {
  return LAYOUT_CLASSES[layoutStyle]?.header ?? LAYOUT_CLASSES.default.header;
}

export function layoutCardClass(layoutStyle: LayoutStyle): string {
  return LAYOUT_CLASSES[layoutStyle]?.card ?? LAYOUT_CLASSES.default.card;
}

export function layoutSectionClass(layoutStyle: LayoutStyle): string {
  return LAYOUT_CLASSES[layoutStyle]?.section ?? LAYOUT_CLASSES.default.section;
}

export function layoutButtonClass(layoutStyle: LayoutStyle): string {
  return LAYOUT_CLASSES[layoutStyle]?.button ?? LAYOUT_CLASSES.default.button;
}

export function layoutBadgeClass(layoutStyle: LayoutStyle): string {
  return LAYOUT_CLASSES[layoutStyle]?.badge ?? LAYOUT_CLASSES.default.badge;
}
