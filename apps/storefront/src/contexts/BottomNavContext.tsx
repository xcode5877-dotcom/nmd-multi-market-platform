import { createContext, useContext, type ReactNode } from 'react';

interface BottomNavContextValue {
  visible: boolean;
  height: number;
}

const BottomNavContext = createContext<BottomNavContextValue>({ visible: false, height: 0 });

export function BottomNavProvider({
  children,
  visible,
  height,
}: {
  children: ReactNode;
  visible: boolean;
  height: number;
}) {
  return (
    <BottomNavContext.Provider value={{ visible, height }}>
      {children}
    </BottomNavContext.Provider>
  );
}

export function useBottomNav() {
  return useContext(BottomNavContext);
}
