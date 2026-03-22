import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const INITIAL_COINS = 50; // Starting balance for new users
const SPIN_COST = 10;

interface CoinsState {
  nowCoins: number;
  addCoins: (amount: number) => void;
  deductCoins: (amount: number) => boolean;
  hasEnoughForSpin: () => boolean;
  spinCost: number;
}

export const useCoinsStore = create<CoinsState>()(
  persist(
    (set, get) => ({
      nowCoins: INITIAL_COINS,
      spinCost: SPIN_COST,
      addCoins: (amount) =>
        set((s) => ({ nowCoins: Math.max(0, s.nowCoins + amount) })),
      deductCoins: (amount) => {
        const { nowCoins } = get();
        if (nowCoins < amount) return false;
        set({ nowCoins: nowCoins - amount });
        return true;
      },
      hasEnoughForSpin: () => get().nowCoins >= get().spinCost,
    }),
    { name: 'nmd-now-coins' }
  )
);
