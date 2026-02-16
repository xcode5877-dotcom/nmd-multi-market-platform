import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface EmergencyModeContextValue {
  enabled: boolean;
  reason: string;
  setEnabled: (v: boolean) => void;
  setReason: (v: string) => void;
  toggle: (reason: string) => void;
}

const EmergencyModeContext = createContext<EmergencyModeContextValue | null>(null);

export function EmergencyModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [reason, setReason] = useState('');

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    if (!v) setReason('');
  }, []);

  const toggle = useCallback((r: string) => {
    if (r.trim()) {
      setReason(r);
      setEnabledState(true);
    } else {
      setEnabledState(false);
      setReason('');
    }
  }, []);

  return (
    <EmergencyModeContext.Provider
      value={{
        enabled,
        reason,
        setEnabled,
        setReason,
        toggle,
      }}
    >
      {children}
    </EmergencyModeContext.Provider>
  );
}

export function useEmergencyMode() {
  const ctx = useContext(EmergencyModeContext);
  return ctx;
}
