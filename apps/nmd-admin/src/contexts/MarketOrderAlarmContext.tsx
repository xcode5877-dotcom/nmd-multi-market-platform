import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();
const ALARM_SRC = '/alarm.mp3';
const REFETCH_MS = 5000;

function playFallbackBeep(audioContextRef: React.MutableRefObject<AudioContext | null>): void {
  try {
    const ctx = audioContextRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (!audioContextRef.current) audioContextRef.current = ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore
  }
}

interface MarketOrderAlarmContextValue {
  hasPendingAlarm: boolean;
  pendingCount: number;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** True when browser blocked autoplay; user must click "Enable Sound Alerts" to unlock. */
  audioBlocked: boolean;
  /** Call after user gesture to unlock audio and retry alarm. */
  enableSoundAlerts: () => void;
  testSound: () => void;
}

const MarketOrderAlarmContext = createContext<MarketOrderAlarmContextValue | null>(null);

export function useMarketOrderAlarm() {
  return useContext(MarketOrderAlarmContext);
}

export function MarketOrderAlarmProvider({
  marketId,
  children,
}: {
  marketId: string | undefined;
  children: ReactNode;
}) {
  const [muted, setMutedState] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ['markets', marketId, 'orders'],
    queryFn: () => api.getMarketOrders(marketId!),
    enabled: !!MOCK_API_URL && !!marketId,
    refetchInterval: REFETCH_MS,
  });

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const hasPendingAlarm = pendingCount > 0;

  const setMuted = useCallback((m: boolean) => setMutedState(m), []);
  const testSound = useCallback(() => {
    if (muted) return;
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(ALARM_SRC);
      audioRef.current = audio;
    }
    audio.volume = 1;
    audio.loop = false;
    audio.play().catch(() => playFallbackBeep(audioContextRef));
  }, [muted]);

  const enableSoundAlerts = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    setAudioBlocked(false);
    testSound();
    const audio = audioRef.current;
    if (audio && hasPendingAlarm && !muted) {
      audio.loop = true;
      audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
    }
  }, [hasPendingAlarm, muted, testSound]);

  useEffect(() => {
    if (!hasPendingAlarm || muted) {
      setAudioBlocked(false);
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(ALARM_SRC);
      audioRef.current = audio;
    }
    audio.volume = 1;
    audio.loop = true;
    audio.play().catch(() => {
      setAudioBlocked(true);
      if (fallbackIntervalRef.current) return;
      fallbackIntervalRef.current = setInterval(
        () => playFallbackBeep(audioContextRef),
        800
      );
    });
    return () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      audio?.pause();
      if (audio) audio.currentTime = 0;
    };
  }, [hasPendingAlarm, muted]);

  const value: MarketOrderAlarmContextValue = {
    hasPendingAlarm,
    pendingCount,
    muted,
    setMuted,
    audioBlocked,
    enableSoundAlerts,
    testSound,
  };

  return (
    <MarketOrderAlarmContext.Provider value={value}>
      {children}
    </MarketOrderAlarmContext.Provider>
  );
}
