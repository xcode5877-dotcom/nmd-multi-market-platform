import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { playSpinSound, playWinSound } from '../lib/spin-sound';

/** Premium palette: Light Slate, Teal, Gift Box = vibrant orange */
const TEAL = '#0f766e';
const TEAL_LIGHT = '#0d9488';
const LIGHT_SLATE = '#e2e8f0';
const GIFT_BOX_ORANGE = '#f97316';
const PRIZES = [
  { id: '1', label: 'خصم 5%', color: TEAL },
  { id: '2', label: 'قهوة مجانية', color: LIGHT_SLATE },
  { id: '3', label: '10 عملات', color: TEAL_LIGHT },
  { id: '4', label: 'شحن مجاني', color: LIGHT_SLATE },
  { id: '5', label: 'حظاً أوفر!', color: TEAL },
  { id: '6', label: '20% خصم', color: LIGHT_SLATE },
  { id: '7', label: 'هدية صغيرة', color: GIFT_BOX_ORANGE },
  { id: '8', label: 'حظاً أوفر!', color: LIGHT_SLATE },
] as const;

const SEGMENT_ANGLE = 360 / PRIZES.length;

interface LuckyWheelProps {
  spinCost: number;
  onSpin: () => boolean;
  onSpinComplete?: (prize: (typeof PRIZES)[number]) => void;
}

export function LuckyWheel({ spinCost, onSpin, onSpinComplete }: LuckyWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<(typeof PRIZES)[number] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [insufficientModalOpen, setInsufficientModalOpen] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);

  const spin = useCallback(() => {
    if (spinning) return;
    const success = onSpin();
    if (!success) {
      setInsufficientModalOpen(true);
      return;
    }

    setSpinning(true);
    playSpinSound();

    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    }

    const extraRotations = 5 + Math.random() * 3;
    const randomIndex = Math.floor(Math.random() * PRIZES.length);
    const targetAngle = 360 - (randomIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);
    const startRotation = rotationRef.current;
    const totalRotation = startRotation + 360 * extraRotations + targetAngle;

    const duration = 3500;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentRotation = startRotation + (totalRotation - startRotation) * easeOut;
      setRotation(currentRotation);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        rotationRef.current = totalRotation;
        const won = PRIZES[randomIndex];
        setPrize(won);
        setModalOpen(true);
        setSpinning(false);
        playWinSound();
        onSpinComplete?.(won);
        if ('vibrate' in navigator) {
          navigator.vibrate([30, 50, 30]);
        }
      }
    };
    requestAnimationFrame(animate);
  }, [spinning, onSpin, onSpinComplete]);

  return (
    <div className="flex flex-col items-center justify-center w-full flex-1 min-h-0 px-2 max-w-[380px] mx-auto">
      {/* Wheel container — 15-20% larger, neon glow */}
      <div
        className="relative w-full aspect-square shrink-0 mx-auto"
        style={{ width: 'min(85vw, 260px)', minWidth: 180, minHeight: 180 }}
      >
        <div
          ref={wheelRef}
          className="absolute inset-0 rounded-full border-[6px] overflow-hidden"
          style={{
            borderColor: TEAL,
            boxShadow: '0 4px 20px rgba(15, 118, 110, 0.25), 0 0 0 1px rgba(15, 118, 110, 0.1)',
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'none' : 'transform 0.1s ease-out',
            background: `conic-gradient(${PRIZES.map(
              (p, i) =>
                `${p.color} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`
            ).join(', ')})`,
          }}
        >
          {PRIZES.map((p, i) => {
            const angle = (i + 0.5) * SEGMENT_ANGLE - 90;
            const rad = (angle * Math.PI) / 180;
            const r = 42;
            const x = 50 + r * Math.cos(rad);
            const y = 50 + r * Math.sin(rad);
            return (
              <div
                key={p.id}
                className="absolute text-[9px] sm:text-[10px] font-bold whitespace-nowrap"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                  color: p.color === GIFT_BOX_ORANGE ? '#ffffff' : '#0a0a0a',
                  textShadow: p.color === GIFT_BOX_ORANGE ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(255,255,255,0.5)',
                }}
              >
                {p.label}
              </div>
            );
          })}
        </div>

        {/* Pointer / needle - Teal */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 w-0 h-0"
          style={{
            borderLeft: '14px solid transparent',
            borderRight: '14px solid transparent',
            borderTop: `24px solid ${TEAL}`,
            filter: 'drop-shadow(0 2px 6px rgba(15, 118, 110, 0.3))',
          }}
        />
      </div>

      {/* Spin button — solid Teal pill */}
      <motion.button
        type="button"
        onClick={spin}
        disabled={spinning}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.02 }}
        className="mt-3 shrink-0 w-full max-w-[200px] mx-auto py-3 px-6 rounded-full font-bold text-base text-white shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
        style={{
          backgroundColor: TEAL,
          color: '#ffffff',
          boxShadow: '0 4px 14px rgba(15, 118, 110, 0.35)',
        }}
      >
        {spinning ? 'جاري الدوران...' : `دور بـ ${spinCost} عملة`}
      </motion.button>

      {/* Insufficient coins modal */}
      <AnimatePresence>
        {insufficientModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,118,110,0.15)' }}
            onClick={() => setInsufficientModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="bg-white rounded-3xl p-8 max-w-[300px] w-full shadow-xl text-center"
              style={{ boxShadow: '0 20px 40px rgba(15,118,110,0.2)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-semibold mb-6" style={{ color: '#0a0a0a' }}>
                عذراً، رصيدك من العملات غير كافٍ
              </p>
              <Link
                to="/"
                className="block w-full py-3.5 px-5 rounded-full font-bold text-white text-center transition-transform active:scale-[0.98]"
                style={{ backgroundColor: TEAL }}
                onClick={() => setInsufficientModalOpen(false)}
              >
                احصل على عملات
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prize modal */}
      <AnimatePresence>
        {modalOpen && prize && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,118,110,0.2)' }}
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-white rounded-3xl p-8 max-w-[320px] w-full text-center"
              style={{ boxShadow: '0 20px 50px rgba(15,118,110,0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm mb-1" style={{ color: '#0a0a0a' }}>فزت بـ</p>
              <p
                className="text-2xl font-bold mb-6"
                style={{ color: '#0a0a0a' }}
              >
                {prize.label}
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-full py-4 rounded-full font-bold text-white transition-transform active:scale-[0.98]"
                style={{ backgroundColor: TEAL }}
              >
                رائع!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
