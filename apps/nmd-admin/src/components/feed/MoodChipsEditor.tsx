import { useRef } from 'react';
import { Button, Input, Select } from '@nmd/ui';
import { GripVertical, Plus, Trash2, Upload } from 'lucide-react';
import { apiUploadSingleImage } from '../../api';
import type { FeedCampaignAction, FeedCampaignChip } from '../../types/feedCampaign';

const CHIP_ACTION_OPTIONS: { value: FeedCampaignAction | 'OPEN_SEARCH'; label: string }[] = [
  { value: 'OPEN_CATEGORY', label: 'فتح تصنيف / عمود' },
  { value: 'OPEN_STORE', label: 'فتح متجر' },
  { value: 'OPEN_SEARCH', label: 'بحث' },
  { value: 'NONE', label: 'بدون إجراء (غير قابل للنقر)' },
];

function emptyChip(sortOrder: number): FeedCampaignChip {
  return {
    label: '',
    emoji: '',
    iconUrl: '',
    action: 'OPEN_CATEGORY',
    targetId: '',
    targetSlug: '',
    sortOrder,
    active: true,
  };
}

type Props = {
  chips: FeedCampaignChip[];
  onChange: (chips: FeedCampaignChip[]) => void;
  onUploadError: (message: string) => void;
};

export default function MoodChipsEditor({ chips, onChange, onUploadError }: Props) {
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const updateChip = (index: number, patch: Partial<FeedCampaignChip>) => {
    onChange(chips.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const addChip = () => {
    onChange([...chips, emptyChip(chips.length + 1)]);
  };

  const removeChip = (index: number) => {
    onChange(
      chips
        .filter((_, i) => i !== index)
        .map((c, i) => ({ ...c, sortOrder: i + 1 })),
    );
  };

  const moveChip = (from: number, to: number) => {
    if (to < 0 || to >= chips.length) return;
    const next = [...chips];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next.map((c, i) => ({ ...c, sortOrder: i + 1 })));
  };

  const uploadIcon = async (index: number, file: File) => {
    try {
      const url = await apiUploadSingleImage(file);
      updateChip(index, { iconUrl: url });
    } catch (e) {
      onUploadError(e instanceof Error ? e.message : 'فشل رفع الأيقونة');
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-teal-100 bg-teal-50/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">عناصر «شو جاي عبالك؟»</p>
          <p className="text-xs text-gray-500 mt-0.5">
            صورة الأيقونة أو إيموجي · الإجراء والهدف · ترتيب السحب
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={addChip} className="gap-1">
          <Plus className="h-4 w-4" />
          إضافة عنصر
        </Button>
      </div>

      {chips.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">لا عناصر — أضف عنصراً ليظهر في التطبيق.</p>
      ) : (
        <div className="space-y-3">
          {chips.map((chip, index) => (
            <div
              key={`${index}-${chip.sortOrder}`}
              className="rounded-lg border border-gray-200 bg-white p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                <span className="text-xs font-semibold text-gray-500">#{chip.sortOrder ?? index + 1}</span>
                <label className="mr-auto flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={chip.active !== false}
                    onChange={(e) => updateChip(index, { active: e.target.checked })}
                  />
                  نشط
                </label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => moveChip(index, index - 1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === chips.length - 1}
                    onClick={() => moveChip(index, index + 1)}
                  >
                    ↓
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeChip(index)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  label="التسمية"
                  value={chip.label}
                  onChange={(e) => updateChip(index, { label: e.target.value })}
                  placeholder="بيتزا"
                />
                <Input
                  label="إيموجي (احتياطي)"
                  value={chip.emoji ?? ''}
                  onChange={(e) => updateChip(index, { emoji: e.target.value })}
                  placeholder="🍕"
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <input
                  ref={(el) => {
                    fileRefs.current[index] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadIcon(index, f);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => fileRefs.current[index]?.click()}
                  className="gap-1"
                >
                  <Upload className="h-3.5 w-3.5" />
                  أيقونة
                </Button>
                {chip.iconUrl ? (
                  <img src={chip.iconUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : null}
                <Input
                  label="رابط الأيقونة"
                  value={chip.iconUrl ?? ''}
                  onChange={(e) => updateChip(index, { iconUrl: e.target.value })}
                  className="flex-1 min-w-[140px]"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <Select
                  label="الإجراء"
                  options={CHIP_ACTION_OPTIONS}
                  value={(chip.action ?? 'OPEN_CATEGORY') as FeedCampaignAction}
                  onChange={(e) =>
                    updateChip(index, {
                      action: e.target.value as FeedCampaignChip['action'],
                    })
                  }
                />
                <Input
                  label="معرّف الهدف (pillar / store id)"
                  value={chip.targetId ?? ''}
                  onChange={(e) => updateChip(index, { targetId: e.target.value })}
                />
              </div>
              <Input
                label="Slug الهدف (اختياري)"
                value={chip.targetSlug ?? ''}
                onChange={(e) => updateChip(index, { targetSlug: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { emptyChip as emptyMoodChip };
