import { useState, useEffect } from 'react';

/** Returns formatted elapsed time (e.g. "5m 32s") from start ISO string. Updates every second. */
export function useElapsedTimer(startIso: string | null | undefined): string {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startIso) {
      setElapsed('');
      return;
    }
    const start = new Date(startIso).getTime();
    const format = () => {
      const sec = Math.floor((Date.now() - start) / 1000);
      if (sec < 0) return '0s';
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };
    setElapsed(format());
    const id = setInterval(() => setElapsed(format()), 1000);
    return () => clearInterval(id);
  }, [startIso]);

  return elapsed;
}
