import { createContext, useContext, useMemo, type ReactNode } from 'react';

const NATIVE_UA = 'NMD-Native-App';

function detectNativeApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.includes(NATIVE_UA);
}

interface NativeBridgeContextValue {
  /** True only when User-Agent contains "NMD-Native-App". No UI changes for regular browsers. */
  isNativeApp: boolean;
}

const NativeBridgeContext = createContext<NativeBridgeContextValue>({
  isNativeApp: false,
});

export function useNativeBridge(): NativeBridgeContextValue {
  return useContext(NativeBridgeContext);
}

export function NativeBridgeProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ isNativeApp: detectNativeApp() }), []);
  return (
    <NativeBridgeContext.Provider value={value}>
      {children}
    </NativeBridgeContext.Provider>
  );
}
