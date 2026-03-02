import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import { OtpLoginModal } from '../components/OtpLoginModal';
import type { Customer } from './CustomerAuthContext';

interface GlobalAuthModalContextValue {
  openAuthModal: (options?: { onSuccess?: (customer: Customer) => void }) => void;
  closeAuthModal: () => void;
}

const GlobalAuthModalContext = createContext<GlobalAuthModalContextValue | null>(null);

export function useGlobalAuthModal(): GlobalAuthModalContextValue {
  const ctx = useContext(GlobalAuthModalContext);
  if (!ctx) throw new Error('useGlobalAuthModal must be used within GlobalAuthModalProvider');
  return ctx;
}

export function GlobalAuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [onSuccess, setOnSuccess] = useState<((customer: Customer) => void) | undefined>();

  const openAuthModal = useCallback((options?: { onSuccess?: (customer: Customer) => void }) => {
    setOnSuccess(() => options?.onSuccess);
    setOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setOpen(false);
    setOnSuccess(undefined);
  }, []);

  const handleSuccess = useCallback(
    (customer: Customer) => {
      onSuccess?.(customer);
      closeAuthModal();
    },
    [onSuccess, closeAuthModal]
  );

  return (
    <GlobalAuthModalContext.Provider value={{ openAuthModal, closeAuthModal }}>
      {children}
      <OtpLoginModal open={open} onClose={closeAuthModal} onSuccess={handleSuccess} />
    </GlobalAuthModalContext.Provider>
  );
}
