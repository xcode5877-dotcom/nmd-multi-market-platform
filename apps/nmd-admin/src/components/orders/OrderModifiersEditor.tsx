/**
 * Modifier selection editor for Super Admin order management.
 * Same selection rules as storefront (required / min / max / single|multi / half placement).
 */
import { useMemo, useState } from 'react';
import { Button } from '@nmd/ui';
import type { OptionGroup, PizzaPlacement } from '@nmd/core';

export type SelectedOptionDraft = {
  optionGroupId: string;
  optionItemIds: string[];
  optionPlacements?: Record<string, PizzaPlacement>;
};

type Props = {
  optionGroups: OptionGroup[];
  initial?: SelectedOptionDraft[];
  onConfirm: (selected: SelectedOptionDraft[]) => void;
  onCancel: () => void;
  confirmLabel?: string;
};

function normalizeInitial(groups: OptionGroup[], initial?: SelectedOptionDraft[]): SelectedOptionDraft[] {
  const byId = new Map((initial ?? []).map((s) => [s.optionGroupId, s]));
  return groups.map((g) => {
    const existing = byId.get(g.id);
    if (existing) return { ...existing, optionItemIds: [...(existing.optionItemIds ?? [])] };
    const defaults = (g.items ?? []).filter((i) => i.defaultSelected).map((i) => i.id);
    return { optionGroupId: g.id, optionItemIds: defaults, optionPlacements: {} };
  });
}

export default function OrderModifiersEditor({
  optionGroups,
  initial,
  onConfirm,
  onCancel,
  confirmLabel = 'تأكيد الإضافات',
}: Props) {
  const groups = useMemo(
    () => (optionGroups ?? []).filter((g) => (g.items?.length ?? 0) > 0),
    [optionGroups]
  );
  const [selected, setSelected] = useState<SelectedOptionDraft[]>(() => normalizeInitial(groups, initial));
  const [error, setError] = useState<string | null>(null);

  const toggle = (group: OptionGroup, itemId: string) => {
    setSelected((prev) => {
      const next = prev.map((s) => ({ ...s, optionItemIds: [...s.optionItemIds] }));
      let row = next.find((s) => s.optionGroupId === group.id);
      if (!row) {
        row = { optionGroupId: group.id, optionItemIds: [], optionPlacements: {} };
        next.push(row);
      }
      const idx = row.optionItemIds.indexOf(itemId);
      if (group.selectionType === 'single') {
        row.optionItemIds = idx >= 0 && row.optionItemIds.length === 1 ? [] : [itemId];
      } else if (idx >= 0) {
        row.optionItemIds.splice(idx, 1);
      } else {
        const max = group.maxSelected ?? Number.MAX_SAFE_INTEGER;
        if (row.optionItemIds.length >= max) return prev;
        row.optionItemIds.push(itemId);
      }
      return [...next];
    });
    setError(null);
  };

  const setPlacement = (groupId: string, itemId: string, placement: PizzaPlacement) => {
    setSelected((prev) =>
      prev.map((s) => {
        if (s.optionGroupId !== groupId) return s;
        return {
          ...s,
          optionPlacements: { ...(s.optionPlacements ?? {}), [itemId]: placement },
        };
      })
    );
  };

  const validate = (): boolean => {
    for (const group of groups) {
      const row = selected.find((s) => s.optionGroupId === group.id);
      const count = row?.optionItemIds?.length ?? 0;
      const min = group.minSelected ?? (group.required ? 1 : 0);
      const max = group.maxSelected ?? (group.selectionType === 'single' ? 1 : Number.MAX_SAFE_INTEGER);
      if (count < min) {
        setError(`مجموعة "${group.name}" تتطلب على الأقل ${min}`);
        return false;
      }
      if (count > max) {
        setError(`مجموعة "${group.name}" تسمح بحد أقصى ${max}`);
        return false;
      }
    }
    return true;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    onConfirm(selected.filter((s) => (s.optionItemIds?.length ?? 0) > 0 || groups.some((g) => g.id === s.optionGroupId && (g.minSelected ?? 0) === 0)));
  };

  if (groups.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">لا توجد إضافات لهذا المنتج.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            إلغاء
          </Button>
          <Button onClick={() => onConfirm([])}>{confirmLabel}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const row = selected.find((s) => s.optionGroupId === group.id);
        const allowHalf = !!(group.allowHalfPlacement || group.allowSplitting);
        return (
          <div key={group.id} className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-800">{group.name}</h4>
              <span className="text-xs text-gray-400">
                {group.required ? 'إلزامي' : 'اختياري'}
                {group.minSelected != null || group.maxSelected != null
                  ? ` · ${group.minSelected ?? 0}–${group.maxSelected ?? '∞'}`
                  : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(group.items ?? []).map((item) => {
                const active = row?.optionItemIds?.includes(item.id) ?? false;
                const delta = item.priceDelta ?? item.priceModifier ?? 0;
                return (
                  <div key={item.id} className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => toggle(group, item.id)}
                      className={`rounded-md border px-2.5 py-1.5 text-sm transition ${
                        active
                          ? 'border-amber-500 bg-amber-50 text-amber-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {item.name}
                      {delta ? (
                        <span className="ms-1 text-xs text-gray-500">
                          {delta > 0 ? '+' : ''}
                          {delta}
                        </span>
                      ) : null}
                    </button>
                    {active && allowHalf && (
                      <div className="flex gap-1">
                        {(['WHOLE', 'LEFT', 'RIGHT'] as PizzaPlacement[]).map((p) => {
                          const cur = row?.optionPlacements?.[item.id] ?? 'WHOLE';
                          const label = p === 'WHOLE' ? 'كامل' : p === 'LEFT' ? 'يسار' : 'يمين';
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPlacement(group.id, item.id, p)}
                              className={`rounded px-1.5 py-0.5 text-[10px] ${
                                cur === p ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          إلغاء
        </Button>
        <Button onClick={handleConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  );
}
