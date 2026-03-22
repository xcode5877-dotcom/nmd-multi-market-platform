import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Card, Button, Modal, useToast } from '@nmd/ui';
import {
  listContests,
  createContest,
  updateContest,
  deleteContest,
  setContestResult,
  getContestParticipations,
  apiUpload,
  type Contest,
  type ContestType,
  type ContestOption,
  type ContestParticipationRow,
} from '../api';
import { Plus, Trash2, ToggleLeft, ToggleRight, Award, Users, ImagePlus } from 'lucide-react';
import { RootOnlyRoute } from '../components/RoleBasedRoute';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export default function ContestsPage() {
  const addToast = useToast().addToast;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState<Contest | null>(null);
  const [participationsOpen, setParticipationsOpen] = useState<Contest | null>(null);
  const [participationsData, setParticipationsData] = useState<{ contest: { id: string; title: string; type: string; correctAnswer?: string | null; isPrediction?: boolean; finalScoreA?: number; finalScoreB?: number }; participations: ContestParticipationRow[] } | null>(null);

  const { data: contests = [], isLoading } = useQuery({
    queryKey: ['contests'],
    queryFn: listContests,
    enabled: !!MOCK_API_URL,
  });

  const createMutation = useMutation({
    mutationFn: createContest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      setCreateOpen(false);
      addToast('تم إنشاء المسابقة', 'success');
      try {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      } catch (_) {}
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateContest>[1] }) => updateContest(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      addToast('تم التحديث', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      addToast('تم الحذف', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const resultMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { correctAnswer?: string } | { finalScoreA: number; finalScoreB: number } }) => setContestResult(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      setResultOpen(null);
      addToast('تم تحديد النتيجة وربط الفائزين', 'success');
      if (participationsOpen?.id === id) getContestParticipations(id).then(setParticipationsData);
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const openParticipations = (c: Contest) => {
    setParticipationsOpen(c);
    getContestParticipations(c.id).then(setParticipationsData);
  };

  if (!MOCK_API_URL) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">المسابقات والتنبؤات</h1>
        <Card className="p-6">
          <p className="text-sm text-amber-600">يتطلب mock-api (VITE_MOCK_API_URL)</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">المسابقات والتنبؤات</h1>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          مسابقة جديدة
        </Button>
      </div>
      <p className="text-sm text-gray-600 mb-4">عرض للمستخدمين المسجلين فقط (هوية الجوال). استخدم نوع سؤال للفوز الفوري، أو تنبؤ لإدخال النتيجة لاحقاً.</p>
      <Card className="p-4">
        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">جاري التحميل...</p>
        ) : contests.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">لا توجد مسابقات. أنشئ مسابقة جديدة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">العنوان</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">النوع</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الحالة</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">النتيجة الصحيحة</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {contests.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">{c.title}</td>
                    <td className="px-4 py-3">{c.type === 'PREDICTION' ? 'تنبؤ' : 'سؤال'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => updateMutation.mutate({ id: c.id, body: { isActive: !c.isActive } })}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {c.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        {c.isActive ? 'نشط' : 'معطّل'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.isPrediction && c.finalScoreA != null && c.finalScoreB != null ? `${c.finalScoreA} - ${c.finalScoreB}` : c.correctAnswer ?? '—'}
                    </td>
                    <td className="px-4 py-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openParticipations(c)} className="gap-1">
                        <Users className="w-4 h-4" />
                        المشاركات
                      </Button>
                      {(c.type === 'PREDICTION' || c.isPrediction) && (
                        <Button variant="outline" size="sm" onClick={() => setResultOpen(c)} className="gap-1">
                          <Award className="w-4 h-4" />
                          إدخال النتيجة
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => window.confirm('حذف المسابقة؟') && deleteMutation.mutate(c.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create modal */}
      <CreateContestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        isSubmitting={createMutation.isPending}
      />

      {/* Enter result modal (PREDICTION) */}
      {resultOpen && (
        <EnterResultModal
          contest={resultOpen}
          onClose={() => setResultOpen(null)}
          onSubmit={(payload) => resultMutation.mutate({ id: resultOpen.id, payload })}
          isSubmitting={resultMutation.isPending}
        />
      )}

      {/* Participations (winners) modal */}
      {participationsOpen && (
        <ParticipationsModal
          contestTitle={participationsOpen.title}
          participationsData={participationsData}
          onClose={() => { setParticipationsOpen(null); setParticipationsData(null); }}
        />
      )}
    </div>
  );
}

function EnterResultModal({
  contest,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  contest: Contest;
  onClose: () => void;
  onSubmit: (payload: { correctAnswer?: string } | { finalScoreA: number; finalScoreB: number }) => void;
  isSubmitting: boolean;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [finalScoreA, setFinalScoreA] = useState<string>(contest.finalScoreA != null ? String(contest.finalScoreA) : '');
  const [finalScoreB, setFinalScoreB] = useState<string>(contest.finalScoreB != null ? String(contest.finalScoreB) : '');
  const options = contest.options || [];
  const isMatchPrediction = !!contest.isPrediction;

  if (isMatchPrediction) {
    const scoreA = parseInt(finalScoreA, 10);
    const scoreB = parseInt(finalScoreB, 10);
    const valid = Number.isInteger(scoreA) && Number.isInteger(scoreB) && scoreA >= 0 && scoreB >= 0;
    return (
      <Modal open title="إدخال النتيجة النهائية (مباراة)" onClose={onClose}>
        <p className="text-sm text-gray-600 mb-4">أدخل نتيجة المباراة النهائية. سيتم تعليم المشاركين الذين توقّعوا نفس النتيجة كفائزين.</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{contest.teamAName || 'الفريق أ'}</label>
            <input
              type="number"
              min={0}
              value={finalScoreA}
              onChange={(e) => setFinalScoreA(e.target.value)}
              disabled={isSubmitting}
              className="w-full border rounded-xl px-4 py-3 min-h-[48px] focus:ring-2 focus:ring-amber-300"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{contest.teamBName || 'الفريق ب'}</label>
            <input
              type="number"
              min={0}
              value={finalScoreB}
              onChange={(e) => setFinalScoreB(e.target.value)}
              disabled={isSubmitting}
              className="w-full border rounded-xl px-4 py-3 min-h-[48px] focus:ring-2 focus:ring-amber-300"
              dir="ltr"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => valid && onSubmit({ finalScoreA: scoreA, finalScoreB: scoreB })} disabled={!valid || isSubmitting}>
            {isSubmitting ? 'جاري الحفظ...' : 'تأكيد النتيجة'}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open title="إدخال النتيجة النهائية" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-2">اختر الإجابة الصحيحة. سيتم تعليم المشاركين الذين اختاروها كفائزين.</p>
      <div className="space-y-2 mb-4">
        {options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="result"
              value={opt.id}
              checked={selectedId === opt.id}
              onChange={() => setSelectedId(opt.id)}
              disabled={isSubmitting}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {options.length === 0 && <p className="text-sm text-amber-600">لا توجد خيارات. أضف خيارات للمسابقة أولاً.</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>إلغاء</Button>
        <Button onClick={() => selectedId && onSubmit({ correctAnswer: selectedId })} disabled={!selectedId || isSubmitting}>
          {isSubmitting ? 'جاري الحفظ...' : 'تأكيد النتيجة'}
        </Button>
      </div>
    </Modal>
  );
}

function ParticipationsModal({
  contestTitle,
  participationsData,
  onClose,
}: {
  contestTitle: string;
  participationsData: { contest: { id: string; title: string; type: string; correctAnswer?: string | null; isPrediction?: boolean; finalScoreA?: number; finalScoreB?: number }; participations: ContestParticipationRow[] } | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'all' | 'winners'>('all');
  const contest = participationsData?.contest;
  const participations = participationsData?.participations ?? [];
  const winners = participations.filter((p) => p.isWinner);
  const resultLabel = contest?.isPrediction && contest?.finalScoreA != null && contest?.finalScoreB != null
    ? `النتيجة النهائية: ${contest.finalScoreA} - ${contest.finalScoreB}`
    : `النتيجة الصحيحة: ${contest?.correctAnswer ?? 'لم تُدخل بعد'}`;

  return (
    <Modal open title={`المشاركات: ${contestTitle}`} onClose={onClose}>
      {participationsData ? (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-gray-600">{resultLabel}</p>
          <div className="flex gap-2 border-b border-gray-200 mb-2">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg ${tab === 'all' ? 'bg-amber-100 text-amber-800 border-b-2 border-amber-500 -mb-px' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              المشاركات ({participations.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('winners')}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg ${tab === 'winners' ? 'bg-amber-100 text-amber-800 border-b-2 border-amber-500 -mb-px' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              الفائزون ({winners.length})
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-start py-1">الجوال</th>
                <th className="text-start py-1">الاسم</th>
                <th className="text-start py-1">{contest?.isPrediction ? 'التوقّع (أ - ب)' : 'الإجابة'}</th>
                <th className="text-start py-1">فائز</th>
              </tr>
            </thead>
            <tbody>
              {(tab === 'winners' ? winners : participations).map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2" dir="ltr">{p.customerPhone ?? '—'}</td>
                  <td className="py-2">{p.customerName ?? '—'}</td>
                  <td className="py-2">
                    {contest?.isPrediction && p.scoreA != null && p.scoreB != null ? `${p.scoreA} - ${p.scoreB}` : p.userAnswer}
                  </td>
                  <td className="py-2">{p.isWinner ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(tab === 'winners' ? winners : participations).length === 0 && (
            <p className="text-gray-500 py-4 text-center">{tab === 'winners' ? 'لا فائزين بعد' : 'لا مشاركات بعد'}</p>
          )}
        </div>
      ) : (
        <p className="text-gray-500">جاري التحميل...</p>
      )}
    </Modal>
  );
}

/** Returns local datetime string for "end of week" (next Sunday 23:59) for datetime-local input. */
function getEndOfWeekDateTimeLocal(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const end = new Date(d);
  end.setDate(d.getDate() + daysUntilSunday);
  end.setHours(23, 59, 0, 0);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const dayNum = String(end.getDate()).padStart(2, '0');
  const h = String(end.getHours()).padStart(2, '0');
  const min = String(end.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${dayNum}T${h}:${min}`;
}

/** Convert datetime-local value to ISO string for API. */
function datetimeLocalToISO(local: string): string {
  if (!local) return '';
  return new Date(local).toISOString();
}

function CreateContestModal({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: { title: string; description?: string; type: ContestType; options?: ContestOption[]; correctAnswer?: string; rewardCode?: string; bannerImageUrl?: string; expiresAt?: string; isPrediction?: boolean; teamAName?: string; teamBName?: string }) => void;
  isSubmitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ContestType>('QUESTION');
  const [isPrediction, setIsPrediction] = useState(false);
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [options, setOptions] = useState<ContestOption[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [rewardCode, setRewardCode] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);

  useEffect(() => {
    if (open && !expiresAt) setExpiresAt(getEndOfWeekDateTimeLocal());
  }, [open, expiresAt]);

  const addOption = useCallback(() => {
    const id = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setOptions((prev) => [...prev, { id, label: `الخيار ${prev.length + 1}` }]);
  }, []);

  const removeOption = useCallback((id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
    if (correctAnswer === id) setCorrectAnswer('');
  }, [correctAnswer]);

  const updateOptionLabel = useCallback((id: string, label: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));
  }, []);

  const handleBannerChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const { urls } = await apiUpload([file]);
      if (urls[0]) setBannerImageUrl(urls[0]);
    } catch (_) {
      setBannerImageUrl('');
    } finally {
      setBannerUploading(false);
      e.target.value = '';
    }
  }, []);

  const handleSubmit = () => {
    const t = title.trim();
    if (!t) return;
    if (type === 'PREDICTION' && isPrediction && (!teamAName.trim() || !teamBName.trim())) return;
    onSubmit({
      title: t,
      description: description.trim() || undefined,
      type,
      options: !isPrediction && options.length > 0 ? options : undefined,
      correctAnswer: correctAnswer.trim() || undefined,
      rewardCode: rewardCode.trim() || undefined,
      bannerImageUrl: bannerImageUrl.trim() || undefined,
      expiresAt: expiresAt.trim() ? datetimeLocalToISO(expiresAt) : undefined,
      isPrediction: type === 'PREDICTION' ? isPrediction : undefined,
      teamAName: isPrediction ? teamAName.trim() || undefined : undefined,
      teamBName: isPrediction ? teamBName.trim() || undefined : undefined,
    });
    setTitle('');
    setDescription('');
    setIsPrediction(false);
    setTeamAName('');
    setTeamBName('');
    setOptions([]);
    setCorrectAnswer('');
    setRewardCode('');
    setBannerImageUrl('');
    setExpiresAt('');
  };

  const optionIcons = ['🎯', '🔮', '⭐', '🏆', '🎪', '🎁', '🌟', '💫'];
  if (!open) return null;
  return (
    <Modal open title="مسابقة جديدة" onClose={onClose} size="lg">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 300 }}
        className="space-y-5"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">العنوان *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-xl px-4 py-3 min-h-[48px] focus:ring-2 focus:ring-amber-300 focus:border-amber-400" placeholder="عنوان المسابقة" dir="rtl" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 min-h-[80px] focus:ring-2 focus:ring-amber-300" rows={2} placeholder="وصف اختياري" dir="rtl" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">النوع</label>
          <select value={type} onChange={(e) => setType(e.target.value as ContestType)} className="w-full border rounded-xl px-4 py-3 min-h-[48px] focus:ring-2 focus:ring-amber-300">
            <option value="QUESTION">سؤال (فوز فوري عند الإجابة الصحيحة)</option>
            <option value="PREDICTION">تنبؤ (إدخال النتيجة لاحقاً)</option>
          </select>
        </div>

        {type === 'PREDICTION' && (
          <div className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/50">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={isPrediction}
                onChange={(e) => { setIsPrediction(e.target.checked); if (e.target.checked) setOptions([]); }}
                className="w-5 h-5 text-amber-600 rounded"
              />
              <span className="font-medium text-gray-800">هل هذه تنبؤ بمباراة (نتيجة مباراة)؟</span>
            </label>
            {isPrediction && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفريق أ</label>
                  <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} className="w-full border rounded-xl px-4 py-3 min-h-[48px] focus:ring-2 focus:ring-amber-300" placeholder="مثلاً: الأهلي" dir="rtl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفريق ب</label>
                  <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} className="w-full border rounded-xl px-4 py-3 min-h-[48px] focus:ring-2 focus:ring-amber-300" placeholder="مثلاً: الزمالك" dir="rtl" />
                </div>
              </div>
            )}
          </div>
        )}

        {(type === 'QUESTION' || (type === 'PREDICTION' && !isPrediction)) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">الخيارات</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {options.map((opt, i) => (
              <motion.div
                key={opt.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="flex items-center gap-3 p-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-amber-300 hover:shadow-md hover:shadow-amber-100/50 transition-all"
              >
                <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center text-2xl shadow-inner">
                  {optionIcons[i % optionIcons.length]}
                </span>
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => updateOptionLabel(opt.id, e.target.value)}
                  className="flex-1 min-w-0 border-0 bg-transparent px-2 py-1 text-sm font-medium focus:ring-0 focus:outline-none"
                  placeholder="نص الخيار"
                  dir="rtl"
                />
                <button
                  type="button"
                  onClick={() => removeOption(opt.id)}
                  className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 min-h-[48px] min-w-[48px] flex items-center justify-center touch-manipulation"
                  aria-label="حذف الخيار"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </div>
          <motion.button
            type="button"
            onClick={addOption}
            className="mt-3 w-full flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-amber-400 bg-gradient-to-b from-amber-50 to-amber-50/50 text-amber-700 font-semibold py-4 min-h-[56px] hover:border-amber-500 hover:shadow-lg hover:shadow-amber-200/40 transition-all touch-manipulation"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-6 h-6" />
            إضافة خيار
          </motion.button>
        </div>
        )}

        {type === 'QUESTION' && options.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الإجابة الصحيحة</label>
            <select value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} className="w-full border rounded-xl px-4 py-3 min-h-[48px] focus:ring-2 focus:ring-amber-300">
              <option value="">— اختر الخيار الصحيح —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="p-4 rounded-2xl border-2 border-dashed border-amber-200 bg-gradient-to-br from-amber-50/50 to-white">
          <label className="block text-sm font-medium text-gray-800 mb-1">🎊 صورة الاحتفال / بانر المسابقة</label>
          <p className="text-xs text-gray-600 mb-3">تظهر في نافذة المسابقة عند دخول المستخدم (همسي)</p>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            {bannerImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-amber-200 bg-white shadow-md max-w-[220px]">
                <img src={bannerImageUrl} alt="بانر" className="w-full h-28 object-cover" />
                <button
                  type="button"
                  onClick={() => setBannerImageUrl('')}
                  className="absolute top-1.5 left-1.5 px-2 py-1 rounded-lg bg-black/60 text-white text-xs hover:bg-black/80"
                >
                  إزالة
                </button>
              </div>
            ) : null}
            <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50/80 px-5 py-4 min-h-[56px] cursor-pointer hover:border-amber-400 hover:bg-amber-100/80 hover:shadow-md hover:shadow-amber-200/30 transition-all touch-manipulation">
              <ImagePlus className="w-6 h-6 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">{bannerUploading ? 'جاري الرفع...' : 'رفع صورة الاحتفال'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} disabled={bannerUploading} />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">كود المكافأة (يُعرض للفائز)</label>
          <input value={rewardCode} onChange={(e) => setRewardCode(e.target.value)} className="w-full border rounded-xl px-4 py-3 min-h-[48px] focus:ring-2 focus:ring-amber-300" placeholder="مثلاً WIN2024" dir="ltr" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">انتهاء الصلاحية</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="flex-1 border rounded-xl px-4 py-3 min-h-[48px] focus:ring-2 focus:ring-amber-300"
              dir="ltr"
            />
            <motion.button
              type="button"
              onClick={() => setExpiresAt(getEndOfWeekDateTimeLocal())}
              className="rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-700 font-medium px-4 py-3 min-h-[48px] whitespace-nowrap hover:bg-amber-100 hover:border-amber-400 transition-colors touch-manipulation"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              نهاية الأسبوع
            </motion.button>
          </div>
          <p className="text-xs text-gray-500 mt-1">اختر تاريخاً ووقتاً أو اضغط «نهاية الأسبوع»</p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
          <Button variant="outline" onClick={onClose} className="min-h-[52px] px-5 w-full sm:w-auto touch-manipulation rounded-xl">
            إلغاء
          </Button>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting || (type === 'PREDICTION' && isPrediction && (!teamAName.trim() || !teamBName.trim()))}
              className="min-h-[52px] px-8 w-full sm:w-auto rounded-xl shadow-lg shadow-amber-300/50 hover:shadow-xl hover:shadow-amber-400/60 transition-shadow touch-manipulation"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'إنشاء المسابقة 🎉'}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </Modal>
  );
}

export function ContestsPageWithGuard() {
  return (
    <RootOnlyRoute>
      <ContestsPage />
    </RootOnlyRoute>
  );
}
