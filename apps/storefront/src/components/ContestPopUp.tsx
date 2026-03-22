import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { Button } from '@nmd/ui';

/** Popup shows only on market/store pages, not on home (/) or landing segments. Saves resources and avoids lag on Home. */
function isMarketPage(pathname: string): boolean {
  if (pathname === '/' || pathname === '') return false;
  if (/^\/(my-activity|my-account|merchant|order)(\/|$)/.test(pathname)) return false;
  return true;
}

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_API_URL) || '';
/** Same key as CustomerAuthContext (Global Identity). Contest API requires Bearer token for /contest/me and /contest/participate. */
const CUSTOMER_TOKEN_KEY = 'nmd-customer-token';

interface ContestOption {
  id: string;
  label: string;
}

interface ActiveContest {
  id: string;
  title: string;
  description?: string;
  type: 'QUESTION' | 'PREDICTION';
  options: ContestOption[];
  rewardCode?: string;
  bannerImageUrl?: string;
  expiresAt?: string;
  isPrediction?: boolean;
  teamAName?: string;
  teamBName?: string;
  finalScoreA?: number;
  finalScoreB?: number;
}

interface Participation {
  contestId: string;
  userAnswer: string;
  isWinner: boolean;
  rewardCode?: string;
  createdAt: string;
}

async function fetchActiveContest(): Promise<ActiveContest | null> {
  if (!API_BASE) return null;
  const t = Date.now();
  const res = await fetch(`${API_BASE}/contest/active?t=${t}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  if (data == null) return null;
  return data as ActiveContest;
}

async function fetchMyParticipations(): Promise<Participation[]> {
  if (!API_BASE) return [];
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;
  if (!token) return [];
  const res = await fetch(`${API_BASE}/contest/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Participation[];
  return Array.isArray(data) ? data : [];
}

async function participate(
  contestId: string,
  payload: { userAnswer: string } | { scoreA: number; scoreB: number }
): Promise<{ id: string; isWinner: boolean; rewardCode?: string }> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;
  if (!token) throw new Error('غير مسجّل الدخول');
  const res = await fetch(`${API_BASE}/contest/participate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contestId, ...payload }),
  });
  const data = (await res.json()) as { id?: string; isWinner?: boolean; rewardCode?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'فشل في المشاركة');
  return { id: data.id ?? '', isWinner: !!data.isWinner, rewardCode: data.rewardCode };
}

const CONTEST_ACTIVE_KEY = ['contest', 'active'];
const CONTEST_ME_KEY = ['contest', 'me'];

export function ContestPopUp() {
  const { pathname } = useLocation();
  const { customer, isLoading: authLoading } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const [wonState, setWonState] = useState<{ rewardCode: string } | null>(null);
  const queryClient = useQueryClient();

  const onMarketPage = useMemo(() => isMarketPage(pathname), [pathname]);

  const { data: activeContest, isLoading: activeLoading } = useQuery({
    queryKey: CONTEST_ACTIVE_KEY,
    queryFn: fetchActiveContest,
    enabled: !!API_BASE && onMarketPage,
    staleTime: 0,
  });

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && API_BASE && onMarketPage) {
        queryClient.invalidateQueries({ queryKey: CONTEST_ACTIVE_KEY });
        queryClient.invalidateQueries({ queryKey: CONTEST_ME_KEY });
      }
    };
    const onFocus = () => {
      if (API_BASE && onMarketPage) {
        queryClient.invalidateQueries({ queryKey: CONTEST_ACTIVE_KEY });
        queryClient.invalidateQueries({ queryKey: CONTEST_ME_KEY });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [queryClient, onMarketPage]);

  const { data: myParticipations = [] } = useQuery({
    queryKey: CONTEST_ME_KEY,
    queryFn: fetchMyParticipations,
    enabled: !!customer && !!API_BASE && !!activeContest && onMarketPage,
    staleTime: 30_000,
  });

  const participateMutation = useMutation({
    mutationFn: ({ contestId, payload }: { contestId: string; payload: { userAnswer: string } | { scoreA: number; scoreB: number } }) => participate(contestId, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: CONTEST_ME_KEY });
      queryClient.invalidateQueries({ queryKey: CONTEST_ACTIVE_KEY });
      try {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.65 } });
        setTimeout(() => { confetti({ particleCount: 60, spread: 100, origin: { x: 0.2, y: 0.6 }, colors: ['#f59e0b', '#fbbf24'] }); }, 150);
        setTimeout(() => { confetti({ particleCount: 60, spread: 100, origin: { x: 0.8, y: 0.6 }, colors: ['#f59e0b', '#fbbf24'] }); }, 280);
      } catch (_) {}
      if (result.isWinner && result.rewardCode) setWonState({ rewardCode: result.rewardCode });
    },
  });

  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const userHasParticipated = !!activeContest && myParticipations.some((p) => p.contestId === activeContest.id);
  const showPopUp = onMarketPage && !!activeContest && !userHasParticipated && !wonState && !dismissedThisSession;
  const showGuestPrompt = showPopUp && !customer;

  const [delayedShow, setDelayedShow] = useState(false);
  useEffect(() => {
    if (!showPopUp && !wonState && !showGuestPrompt) {
      setDelayedShow(false);
      return;
    }
    const t = setTimeout(() => setDelayedShow(true), 500);
    return () => clearTimeout(t);
  }, [showPopUp, wonState, showGuestPrompt]);

  useEffect(() => {
    if (wonState) {
      try {
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 }, colors: ['#f59e0b', '#fbbf24', '#fcd34d'] });
      } catch (_) {}
    }
  }, [wonState]);

  const closeWon = useCallback(() => setWonState(null), []);

  const [selectedId, setSelectedId] = useState('');
  const [scoreA, setScoreA] = useState<string>('0');
  const [scoreB, setScoreB] = useState<string>('0');
  useEffect(() => {
    if (activeContest?.options?.length) setSelectedId(activeContest.options[0]?.id ?? '');
    else setSelectedId('');
  }, [activeContest?.id, activeContest?.options]);

  if (!API_BASE || !onMarketPage) return null;
  if (authLoading || activeLoading) return null;
  if (!showPopUp && !wonState && !showGuestPrompt) return null;
  if ((showPopUp || wonState || showGuestPrompt) && !delayedShow) return null;

  if (showGuestPrompt) {
    return (
      <div key={`contest-guest-${activeContest!.id}`} className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom,80px))] bg-black/50" role="dialog" aria-modal="true" aria-labelledby="contest-guest-title">
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 320 }}
          className="bg-white rounded-2xl shadow-xl w-[92vw] max-w-md p-6 text-center"
        >
          <h2 id="contest-guest-title" className="text-lg font-bold text-gray-900 mb-2">{activeContest!.title}</h2>
          <p className="text-sm text-gray-600 mb-4">مسابقة نشطة. سجّل الدخول للمشاركة.</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => openAuthModal()} className="min-h-[48px] w-full rounded-xl touch-manipulation">
              سجّل الدخول للمشاركة
            </Button>
            <Button variant="outline" onClick={() => setDismissedThisSession(true)} className="min-h-[48px] w-full rounded-xl touch-manipulation" type="button">
              تخطي
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (wonState) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom,80px))] bg-black/50" role="dialog" aria-modal="true" aria-label="تهانينا">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 320 }}
          className="bg-white rounded-2xl shadow-xl w-[92vw] max-w-sm p-6 text-center"
        >
          <div className="text-5xl mb-2">🎉</div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">تهانينا!</h3>
          <p className="text-gray-600 mb-4">أنت من الفائزين. استخدم الرمز أدناه للحصول على مكافأتك.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm text-amber-800 font-mono font-bold text-lg">{wonState.rewardCode}</p>
          </div>
          <Button onClick={closeWon} className="min-h-[48px] px-6 w-full sm:w-auto rounded-xl shadow-lg shadow-amber-300/50 hover:shadow-xl hover:shadow-amber-400/60 transition-shadow touch-manipulation">إغلاق</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div key={`contest-modal-${activeContest!.id}`} className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom,80px))] bg-black/50" role="dialog" aria-modal="true" aria-labelledby="contest-title">
      <motion.div
        key={`contest-content-${activeContest!.id}`}
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 16, stiffness: 320 }}
        className="bg-white rounded-2xl shadow-xl w-[92vw] max-w-md overflow-hidden"
      >
        {activeContest!.bannerImageUrl && (
          <div className="w-full aspect-[2/1] bg-gray-100 overflow-hidden">
            <img src={activeContest!.bannerImageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-b from-amber-50 to-white">
          <h2 id="contest-title" className="text-lg font-bold text-gray-900">{activeContest!.title}</h2>
          {activeContest!.description && <p className="text-sm text-gray-600 mt-1">{activeContest!.description}</p>}
        </div>
        <form
          className="p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!activeContest) return;
            if (activeContest.isPrediction) {
              const a = parseInt(scoreA, 10);
              const b = parseInt(scoreB, 10);
              if (Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0) {
                participateMutation.mutate({ contestId: activeContest.id, payload: { scoreA: a, scoreB: b } });
              }
            } else if (selectedId) {
              participateMutation.mutate({ contestId: activeContest.id, payload: { userAnswer: selectedId } });
            }
          }}
        >
          {activeContest!.isPrediction ? (
            <>
              <p className="text-sm text-gray-600 mb-3">توقّع نتيجة المباراة:</p>
              <div className="space-y-4 mb-4">
                <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 bg-gray-50/50">
                  <motion.span className="text-2xl" animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                    ⚽
                  </motion.span>
                  <span className="font-medium text-gray-800 flex-1">{activeContest!.teamAName || 'الفريق أ'}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    disabled={participateMutation.isPending}
                    className="w-16 text-center border rounded-xl px-2 py-3 min-h-[48px] text-lg font-bold focus:ring-2 focus:ring-amber-300"
                    dir="ltr"
                    aria-label="نتيجة الفريق أ"
                  />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 bg-gray-50/50">
                  <motion.span className="text-2xl" animate={{ rotate: [0, -15, 15, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}>
                    ⚽
                  </motion.span>
                  <span className="font-medium text-gray-800 flex-1">{activeContest!.teamBName || 'الفريق ب'}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    disabled={participateMutation.isPending}
                    className="w-16 text-center border rounded-xl px-2 py-3 min-h-[48px] text-lg font-bold focus:ring-2 focus:ring-amber-300"
                    dir="ltr"
                    aria-label="نتيجة الفريق ب"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                {activeContest!.type === 'PREDICTION' ? 'اختر توقّعك:' : 'اختر إجابتك:'}
              </p>
              <div className="space-y-2 mb-4">
                {(activeContest!.options || []).map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-3 p-3 min-h-[48px] rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 cursor-pointer transition-colors touch-manipulation"
                  >
                    <input
                      type="radio"
                      name="contest-option"
                      value={opt.id}
                      checked={selectedId === opt.id}
                      onChange={() => setSelectedId(opt.id)}
                      disabled={participateMutation.isPending}
                      className="w-5 h-5 text-amber-600 flex-shrink-0"
                    />
                    <span className="font-medium text-gray-800">{opt.label}</span>
                  </label>
                ))}
              </div>
              {activeContest!.options?.length === 0 && (
                <p className="text-sm text-amber-600 mb-4">لا توجد خيارات لهذه المسابقة.</p>
              )}
            </>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDismissedThisSession(true)}
              disabled={participateMutation.isPending}
              className="min-h-[48px] w-full sm:w-auto touch-manipulation"
            >
              تخطي
            </Button>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
              <Button
                type="submit"
                disabled={
                  participateMutation.isPending ||
                  (activeContest!.isPrediction
                    ? !/^\d+$/.test(scoreA) || !/^\d+$/.test(scoreB)
                    : !selectedId)
                }
                className="min-h-[48px] w-full sm:w-auto rounded-xl shadow-lg shadow-amber-300/50 hover:shadow-xl hover:shadow-amber-400/70 transition-shadow touch-manipulation"
              >
                {participateMutation.isPending ? 'جاري الإرسال...' : 'إرسال'}
              </Button>
            </motion.div>
          </div>
          {participateMutation.isError && (
            <p className="text-sm text-red-600 mt-2">{participateMutation.error?.message}</p>
          )}
        </form>
      </motion.div>
    </div>
  );
}
