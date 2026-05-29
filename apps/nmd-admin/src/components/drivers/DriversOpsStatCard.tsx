import type { LucideIcon } from 'lucide-react';

export function DriversOpsStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'info';
}) {
  const toneClasses = {
    default: 'bg-white border-gray-200',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-sky-50 border-sky-200',
  }[tone];

  return (
    <div className={`p-4 rounded-xl border shadow-sm ${toneClasses}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
          {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
        </div>
        <div className="p-2 rounded-lg bg-white/80 text-gray-600 shrink-0">
          <Icon className="w-5 h-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}
