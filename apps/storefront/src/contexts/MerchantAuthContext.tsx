import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

const MERCHANT_ROLE_KEY = 'nmd-merchant-role';
const MERCHANT_TENANT_KEY = 'nmd-merchant-tenant-id';

interface MerchantAuthContextValue {
  isMerchant: boolean;
  merchantTenantId: string | null;
  loginAsMerchant: (tenantId: string) => void;
  logoutMerchant: () => void;
}

const MerchantAuthContext = createContext<MerchantAuthContextValue | null>(null);

export function useMerchantAuth(): MerchantAuthContextValue {
  const ctx = useContext(MerchantAuthContext);
  if (!ctx) throw new Error('useMerchantAuth must be used within MerchantAuthProvider');
  return ctx;
}

export function MerchantAuthProvider({ children }: { children: ReactNode }) {
  const [isMerchant, setIsMerchant] = useState(false);
  const [merchantTenantId, setMerchantTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const role = localStorage.getItem(MERCHANT_ROLE_KEY);
    const tenantId = localStorage.getItem(MERCHANT_TENANT_KEY);
    setIsMerchant(role === 'merchant');
    setMerchantTenantId(tenantId);
  }, []);

  const loginAsMerchant = useCallback((tenantId: string) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MERCHANT_ROLE_KEY, 'merchant');
      localStorage.setItem(MERCHANT_TENANT_KEY, tenantId);
    }
    setIsMerchant(true);
    setMerchantTenantId(tenantId);
  }, []);

  const logoutMerchant = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(MERCHANT_ROLE_KEY);
      localStorage.removeItem(MERCHANT_TENANT_KEY);
    }
    setIsMerchant(false);
    setMerchantTenantId(null);
  }, []);

  const value: MerchantAuthContextValue = {
    isMerchant,
    merchantTenantId,
    loginAsMerchant,
    logoutMerchant,
  };

  return <MerchantAuthContext.Provider value={value}>{children}</MerchantAuthContext.Provider>;
}
