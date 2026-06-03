import { useMemo, useState } from 'react';
import { Input } from '@nmd/ui';
import { asArray } from '../../lib/feedCampaignNormalize';

export type StorePickerTenant = {
  id: string;
  name?: string;
  slug?: string;
  logoUrl?: string;
};

type Props = {
  tenants: StorePickerTenant[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export default function HomePageStorePicker({ tenants, selectedIds, onChange }: Props) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = asArray<StorePickerTenant>(tenants);
    if (!q) return list;
    return list.filter((t) => {
      const name = (t.name ?? '').toLowerCase();
      const slug = (t.slug ?? '').toLowerCase();
      return name.includes(q) || slug.includes(q) || t.id.toLowerCase().includes(q);
    });
  }, [tenants, query]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div className="space-y-2">
      <Input
        label="بحث عن محل"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="اسم المحل أو المعرف…"
      />
      <p className="text-xs text-gray-500">
        محدد: {selectedIds.length} — اختر المحلات بالترتيب الذي تريد عرضه
      </p>
      <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
        {filtered.map((t) => {
          const checked = selected.has(t.id);
          return (
            <label
              key={t.id}
              className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-teal-50/60' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(t.id)}
                className="shrink-0"
              />
              {t.logoUrl ? (
                <img
                  src={t.logoUrl}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-lg">
                  🏪
                </div>
              )}
              <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                {t.name || t.slug || t.id}
              </span>
            </label>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-gray-500 text-center">لا توجد محلات</p>
        )}
      </div>
    </div>
  );
}
