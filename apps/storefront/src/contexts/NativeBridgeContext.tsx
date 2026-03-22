import { createContext, useContext, useMemo } from 'react';

const NATIVE_UA = 'NMD-Native-App';
const NATIVE_ANDROID_UA = 'NMD-Android-App';

function detectNativeApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return ua.includes(NATIVE_UA) || ua.includes(NATIVE_ANDROID_UA);
}

const NativeBridgeContext = createContext<{ isNativeApp: boolean }>({ isNativeApp: false });

export function useNativeBridge() {
  return useContext(NativeBridgeContext);
}

export function NativeBridgeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ isNativeApp: detectNativeApp() }), []);
  return <NativeBridgeContext.Provider value={value}>{children}</NativeBridgeContext.Provider>;
}
