import { useCoinsStore } from '../store/coins';

/** Global Now Coins state for Lucky Wheel and rewards. */
export function useCoins() {
  const nowCoins = useCoinsStore((s) => s.nowCoins);
  const addCoins = useCoinsStore((s) => s.addCoins);
  const deductCoins = useCoinsStore((s) => s.deductCoins);
  const hasEnoughForSpin = useCoinsStore((s) => s.hasEnoughForSpin);
  const spinCost = useCoinsStore((s) => s.spinCost);

  return { nowCoins, addCoins, deductCoins, hasEnoughForSpin, spinCost };
}
