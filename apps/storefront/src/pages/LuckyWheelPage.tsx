import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { LuckyWheel } from '../components/LuckyWheel';
import { useCoins } from '../hooks/useCoins';

export default function LuckyWheelPage() {
  const { nowCoins, deductCoins, hasEnoughForSpin, spinCost, addCoins } = useCoins();

  const handleSpin = () => {
    if (!hasEnoughForSpin()) return false;
    return deductCoins(spinCost);
  };

  const handleSpinComplete = (prize: { id: string; label: string }) => {
    if (prize.label === '10 عملات') {
      addCoins(10);
    }
  };

  return (
    <div
      className="flex flex-col min-h-[calc(100vh-var(--global-header-height,56px))] max-h-screen overflow-hidden w-full p-0 m-0"
      style={{ width: '100%', backgroundColor: '#ffffff', overflow: 'hidden' }}
    >
      <div className="flex flex-col h-full min-h-0 flex-1 items-center justify-around px-3 py-2 overflow-hidden w-full pb-[100px]" style={{ margin: 0 }}>
        {/* Coins banner — sleek teal-bordered pill, dark text */}
        <div
          className="shrink-0 flex items-center justify-center gap-3 py-3.5 px-6 rounded-full mb-3 mx-auto max-w-[300px]"
          style={{
            border: '2px solid #0f766e',
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 14px rgba(15, 118, 110, 0.15)',
          }}
        >
          <Coins className="w-5 h-5 flex-shrink-0" style={{ color: '#0f766e' }} strokeWidth={2.5} />
          <span className="font-bold text-base" style={{ color: '#0a0a0a' }}>عملاتك: {nowCoins}</span>
          <span className="w-px h-5 bg-[#0f766e]/30 flex-shrink-0" aria-hidden />
          <Link
            to="/"
            className="text-sm font-semibold shrink-0"
            style={{ color: '#0f766e' }}
          >
            الرئيسية
          </Link>
        </div>

        {/* Wheel + Spin — flex-1, centered */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden">
          <LuckyWheel
            spinCost={spinCost}
            onSpin={handleSpin}
            onSpinComplete={handleSpinComplete}
          />
        </div>
      </div>
    </div>
  );
}
