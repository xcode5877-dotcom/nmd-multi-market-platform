import { useQuery } from '@tanstack/react-query';
import type { ModifierIcon } from '@nmd/core';
import { fetchMarketModifierIcons } from '../lib/modifierIcons';

type Props = {
  marketSlug: string;
  value?: string;
  onChange: (key: string | undefined) => void;
  disabled?: boolean;
  className?: string;
};

export default function ModifierIconKeySelect({
  marketSlug,
  value,
  onChange,
  disabled,
  className = '',
}: Props) {
  const { data: icons = [], isLoading } = useQuery({
    queryKey: ['modifier-icons', marketSlug],
    queryFn: () => fetchMarketModifierIcons(marketSlug),
    enabled: !!marketSlug.trim(),
    staleTime: 60_000,
  });

  const active = icons.filter((i) => i.active);

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">أيقونة الإضافة</label>
      <select
        value={value ?? ''}
        disabled={disabled || isLoading}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
      >
        <option value="">تلقائي (حسب الاسم)</option>
        {active.map((icon) => (
          <option key={icon.key} value={icon.key}>
            {icon.labelAr} ({icon.key})
          </option>
        ))}
      </select>
      {value && (
        <IconPreview icons={active} iconKey={value} />
      )}
    </div>
  );
}

function IconPreview({ icons, iconKey }: { icons: ModifierIcon[]; iconKey: string }) {
  const icon = icons.find((i) => i.key === iconKey);
  if (!icon?.iconUrl) {
    return (
      <p className="text-[10px] text-gray-500 mt-1">سيتم استخدام أيقونة النظام الافتراضية لـ «{iconKey}»</p>
    );
  }
  return (
    <img
      src={icon.iconUrl}
      alt=""
      className="mt-1 w-8 h-8 object-contain rounded border bg-gray-50"
    />
  );
}
