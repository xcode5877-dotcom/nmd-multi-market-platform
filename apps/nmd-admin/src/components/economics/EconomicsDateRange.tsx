import { Button } from '@nmd/ui';
import type { DateRangePreset } from '../../lib/economics';

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: '7d', label: '7 أيام' },
  { id: '30d', label: '30 يوم' },
  { id: 'custom', label: 'مخصص' },
];

type Props = {
  preset: DateRangePreset;
  customFrom: string;
  customTo: string;
  onPresetChange: (p: DateRangePreset) => void;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
};

export default function EconomicsDateRange({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.id}
          variant={preset === p.id ? 'primary' : 'outline'}
          size="sm"
          onClick={() => onPresetChange(p.id)}
        >
          {p.label}
        </Button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5"
          />
        </div>
      )}
    </div>
  );
}
