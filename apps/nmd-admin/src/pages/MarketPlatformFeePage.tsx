import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Percent, RotateCcw } from 'lucide-react';
import { Card, Button, useToast } from '@nmd/ui';
import { useAuth } from '../contexts/AuthContext';
import { useEmergencyMode } from '../contexts/EmergencyModeContext';
import { apiFetch, apiHeaders } from '../api';
import PlatformFeeDisabledBanner from '../components/platform-fee/PlatformFeeDisabledBanner';
import PlatformFeeConfigFields from '../components/platform-fee/PlatformFeeConfigFields';
import PlatformFeePreviewCalculator from '../components/platform-fee/PlatformFeePreviewCalculator';
import {
  DEFAULT_PLATFORM_FEE_CONFIG,
  disabledPlatformFeeConfig,
  isPlatformAdminRole,
  type PlatformFeeConfig,
} from '../lib/platform-fee';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

type MarketRecord = {
  id: string;
  name: string;
  slug: string;
  platformFeeConfig?: PlatformFeeConfig;
};

function configFromMarket(market: MarketRecord | undefined): PlatformFeeConfig {
  const raw = market?.platformFeeConfig;
  if (!raw) return { ...DEFAULT_PLATFORM_FEE_CONFIG, enabled: false };
  return {
    enabled: raw.enabled ?? false,
    model: raw.model ?? 'PERCENTAGE',
    percentage: raw.percentage ?? 8,
    fixedPerOrder: raw.fixedPerOrder ?? 0,
    fixedPerItem: raw.fixedPerItem ?? 0,
    minFee: raw.minFee ?? 2,
    maxFee: raw.maxFee ?? 50,
  };
}

export default function MarketPlatformFeePage() {
  const { id: marketId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const emergency = useEmergencyMode();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const platformAdmin = isPlatformAdminRole(user?.role);
  const isRootAdmin = user?.role === 'ROOT_ADMIN';
  const canWrite =
    user?.role === 'SUPER_ADMIN' || (isRootAdmin && !!emergency?.enabled && !!emergency?.reason?.trim());

  const { data: market, isLoading } = useQuery({
    queryKey: ['market', marketId],
    queryFn: () =>
      fetch(`${MOCK_API_URL}/markets/${marketId}`, { headers: apiHeaders() }).then((r) =>
        r.ok ? (r.json() as Promise<MarketRecord>) : Promise.reject(new Error('Not found'))
      ),
    enabled: !!marketId && !!MOCK_API_URL && platformAdmin,
  });

  const savedConfig = useMemo(() => configFromMarket(market), [market]);
  const [localConfig, setLocalConfig] = useState<PlatformFeeConfig>(savedConfig);

  useEffect(() => {
    setLocalConfig(savedConfig);
  }, [savedConfig]);

  const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(savedConfig);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<MarketRecord>(`/markets/${marketId}`, {
        method: 'PUT',
        body: JSON.stringify({ platformFeeConfig: localConfig }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market', marketId] });
      addToast('تم حفظ إعدادات رسوم المنصة للسوق', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل الحفظ', 'error'),
  });

  if (!MOCK_API_URL) {
    return (
      <div className="p-4 text-amber-800 bg-amber-50 rounded-lg border border-amber-200">
        لتشغيل هذه الصفحة، ضبط VITE_MOCK_API_URL
      </div>
    );
  }

  if (!platformAdmin) {
    return (
      <div className="p-8 text-center text-gray-600">
        <p>إعداد رسوم المنصة متاح فقط لمسؤول المنصة (ROOT / SUPER).</p>
        <Link to={marketId ? `/markets/${marketId}` : '/markets'} className="text-primary text-sm mt-2 inline-block">
          العودة
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/markets/${marketId}`} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Percent className="w-6 h-6 text-teal-600" />
            رسوم منصة Now Market
          </h1>
          <p className="text-sm text-gray-500">{market?.name ?? marketId}</p>
        </div>
      </div>

      <PlatformFeeDisabledBanner />

      {isRootAdmin && !canWrite && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          فعّل وضع الطوارئ مع سبب من الشريط الجانبي قبل الحفظ (ROOT_ADMIN).
        </div>
      )}

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">رسوم المنصة — الإعداد الافتراضي للسوق</h2>
        <p className="text-sm text-gray-500 mb-4">
          تُضاف على سعر الزبون ولا تظهر لصاحب المتجر كربح للمنصة. تُطبّق على جميع متاجر السوق ما لم يُحدّد متجر
          إعدادًا خاصًا.
        </p>
        <PlatformFeeConfigFields config={localConfig} onChange={setLocalConfig} idPrefix="market-pf" />
        <div className="flex flex-wrap gap-2 mt-6">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canWrite || saveMutation.isPending || !hasChanges}
          >
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ إعدادات السوق'}
          </Button>
          <Button
            type="button"
            variant="outline"
            leftIcon={<RotateCcw className="w-4 h-4" />}
            onClick={() => setLocalConfig(disabledPlatformFeeConfig())}
            disabled={!canWrite}
          >
            إعادة تعيين (معطّل)
          </Button>
          {hasChanges && (
            <Button type="button" variant="ghost" onClick={() => setLocalConfig(savedConfig)}>
              تراجع
            </Button>
          )}
        </div>
      </Card>

      <PlatformFeePreviewCalculator marketFeeConfig={localConfig} title="معاينة — إعداد السوق" />
    </div>
  );
}
