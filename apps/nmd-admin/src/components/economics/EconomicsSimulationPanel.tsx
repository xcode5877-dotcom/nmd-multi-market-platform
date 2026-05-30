import { useMemo, useState } from 'react';
import { Card, Input } from '@nmd/ui';
import { Calculator } from 'lucide-react';
import {
  formatMoney,
  runSimulation,
  simulationDefaultsFromOverview,
  type OverviewMetrics,
  type SimulationInput,
  type SimulationOutput,
} from '../../lib/economics';
import type { NormalizedOrder } from '../../lib/economics';

type Props = {
  overview: OverviewMetrics;
  normalized: NormalizedOrder[];
  monthlyOperationalCosts: number;
  periodDays: number;
};

function SimField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-1 mt-1">
        <Input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="text-sm"
        />
        {suffix && <span className="text-xs text-gray-500 whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  );
}

export default function EconomicsSimulationPanel({
  overview,
  normalized,
  monthlyOperationalCosts,
  periodDays,
}: Props) {
  const defaults = useMemo(
    () => simulationDefaultsFromOverview(overview, normalized, monthlyOperationalCosts, periodDays),
    [overview, normalized, monthlyOperationalCosts, periodDays]
  );

  const [input, setInput] = useState<SimulationInput>(defaults);

  const output: SimulationOutput = useMemo(() => runSimulation(input), [input]);

  const patch = (p: Partial<SimulationInput>) => setInput((prev) => ({ ...prev, ...p }));

  return (
    <Card className="overflow-hidden border-2 border-violet-200">
      <div className="p-5 bg-gradient-to-l from-violet-50 to-white border-b border-violet-100">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-violet-700" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">محرك المحاكاة</h2>
            <p className="text-sm text-violet-800/80">
              تقدير فقط — لا يفعّل الرسوم ولا يغيّر الطلبات
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 grid lg:grid-cols-2 gap-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <SimField label="نسبة الرسوم %" value={input.percentageFee} onChange={(n) => patch({ percentageFee: n })} />
          <SimField label="حد أدنى ₪" value={input.minFee} onChange={(n) => patch({ minFee: n })} />
          <SimField label="حد أقصى ₪" value={input.maxFee} onChange={(n) => patch({ maxFee: n })} />
          <SimField label="ثابت / طلب ₪" value={input.fixedFee} onChange={(n) => patch({ fixedFee: n })} />
          <SimField label="بوابة دفع %" value={input.gatewayPct} onChange={(n) => patch({ gatewayPct: n })} />
          <SimField label="تكلفة توصيل / طلب ₪" value={input.avgDeliveryCost} onChange={(n) => patch({ avgDeliveryCost: n })} />
          <SimField label="تكاليف شهرية ₪" value={input.monthlyOperationalCosts} onChange={(n) => patch({ monthlyOperationalCosts: n })} />
          <SimField label="طلبات / شهر" value={input.ordersPerMonth} onChange={(n) => patch({ ordersPerMonth: n })} />
          <SimField label="متوسط سلة ₪" value={input.avgOrderValue} onChange={(n) => patch({ avgOrderValue: n })} />
          <SimField label="رسوم توصيل متوسط ₪" value={input.avgDeliveryFee} onChange={(n) => patch({ avgDeliveryFee: n })} />
          <SimField label="نسبة فيزا" value={Math.round(input.cardOrderRatio * 100)} onChange={(n) => patch({ cardOrderRatio: n / 100 })} suffix="%" />
          <SimField label="نسبة كوبون %" value={input.couponRatePct} onChange={(n) => patch({ couponRatePct: n })} />
        </div>

        <div className="space-y-3">
          <OutputRow label="إيراد رسوم منصة / شهر" value={output.projectedMonthlyPlatformRevenue} accent="emerald" />
          <OutputRow label="هامش توصيل / شهر" value={output.projectedMonthlyDeliveryMargin} />
          <OutputRow label="تكلفة بوابة / شهر" value={-output.projectedMonthlyGatewayCost} accent="red" />
          <OutputRow label="كوبونات / شهر" value={-output.projectedMonthlyCouponCost} accent="red" />
          <OutputRow label="مساهمة صافية / شهر" value={output.projectedMonthlyContribution} accent="indigo" bold />
          <OutputRow
            label="ربح / خسارة vs التكاليف"
            value={output.projectedProfitLoss}
            accent={output.projectedProfitLoss >= 0 ? 'emerald' : 'red'}
            bold
          />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-gray-50 border">
              <p className="text-xs text-gray-500">نقطة التعادل / شهر</p>
              <p className="text-lg font-bold">{output.breakEvenOrdersPerMonth.toLocaleString('ar')}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border">
              <p className="text-xs text-gray-500">مساهمة / طلب</p>
              <p className="text-lg font-bold">{formatMoney(output.contributionPerOrder)}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function OutputRow({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: number;
  accent?: 'emerald' | 'red' | 'indigo';
  bold?: boolean;
}) {
  const color =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'red'
        ? 'text-red-600'
        : accent === 'indigo'
          ? 'text-indigo-700'
          : 'text-gray-900';
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`${bold ? 'font-bold text-base' : 'font-medium'} ${color}`}>{formatMoney(value)}</span>
    </div>
  );
}
