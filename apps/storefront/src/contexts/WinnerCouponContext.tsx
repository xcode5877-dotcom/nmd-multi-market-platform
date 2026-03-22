import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface WinnerCouponContextValue {
  /** True after user has applied a winner coupon (e.g. at checkout). Used to hide the sticky banner. */
  couponApplied: boolean;
  markCouponApplied: () => void;
}

const WinnerCouponContext = createContext<WinnerCouponContextValue | null>(null);

export function useWinnerCoupon(): WinnerCouponContextValue {
  const ctx = useContext(WinnerCouponContext);
  if (!ctx) return { couponApplied: false, markCouponApplied: () => {} };
  return ctx;
}

export function WinnerCouponProvider({ children }: { children: ReactNode }) {
  const [couponApplied, setCouponApplied] = useState(false);
  const markCouponApplied = useCallback(() => setCouponApplied(true), []);
  return (
    <WinnerCouponContext.Provider value={{ couponApplied, markCouponApplied }}>
      {children}
    </WinnerCouponContext.Provider>
  );
}
