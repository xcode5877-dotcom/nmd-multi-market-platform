import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, WholeCircleIcon, LeftHalfCircleIcon, RightHalfCircleIcon } from '@nmd/ui';
import { formatMoney, type PizzaPlacement } from '@nmd/core';
import type { Product, OptionGroup, OptionItem } from '@nmd/core';

const TEAL = '#0f766e';

export type Placement = PizzaPlacement;

export interface AddonSelection {
  key: string;
  groupId: string;
  optionId: string;
  label: string;
  priceDelta: number;
  placement: Placement;
}

export type AddonsState = Record<string, AddonSelection>;

export interface AddonForCart {
  optionGroupId: string;
  optionItemIds: string[];
  optionPlacements: Record<string, Placement>;
}

function optionSupportsHalf(item: OptionItem, group: OptionGroup): boolean {
  return item.placement === 'HALF' || (!!group.allowHalfPlacement && item.placement !== 'WHOLE');
}

function getOptionStock(product: Product, groupId: string, optionId: string): number {
  const variants = product.variants ?? [];
  if (variants.length === 0) return 1;
  const relevant = variants.filter((v) =>
    v.optionValues.some((ov) => ov.groupId === groupId && ov.optionId === optionId)
  );
  return relevant.reduce((sum, v) => sum + v.stock, 0);
}

function toCartEntries(addons: AddonsState): AddonForCart[] {
  const byGroup = new Map<string, { ids: string[]; placements: Record<string, Placement> }>();
  for (const sel of Object.values(addons)) {
    const existing = byGroup.get(sel.groupId) ?? { ids: [], placements: {} };
    existing.ids.push(sel.optionId);
    existing.placements[sel.optionId] = sel.placement;
    byGroup.set(sel.groupId, existing);
  }
  return Array.from(byGroup.entries()).map(([optionGroupId, { ids, placements }]) => ({
    optionGroupId,
    optionItemIds: ids,
    optionPlacements: placements,
  }));
}

export interface PizzaAddonsSelectorProps {
  optionGroups: OptionGroup[];
  product: Product;
  onChange: (addons: AddonForCart[]) => void;
}

export function PizzaAddonsSelector({ optionGroups, product, onChange }: PizzaAddonsSelectorProps) {
  const [addons, setAddons] = useState<AddonsState>({});

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current(toCartEntries(addons));
  }, [addons]);

  /**
   * Ensure addon exists. ALWAYS merges with prev - never replaces.
   * UNLIMITED: We intentionally do NOT enforce group.maxSelected here.
   */
  const ensureAddon = useCallback(
    (key: string, payload: { groupId: string; optionId: string; label: string; priceDelta: number }, placement: Placement) => {
      const group = optionGroups.find((g) => g.id === payload.groupId);
      if (!group) return;

      setAddons((prev) => {
        if (prev[key]) return { ...prev, [key]: { ...prev[key], placement } };
        return { ...prev, [key]: { key, ...payload, placement } };
      });
    },
    [optionGroups]
  );

  /** Remove addon. Merges - never replaces. */
  const removeAddon = useCallback((key: string) => {
    setAddons((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  /** Set placement for existing addon, or add with placement. */
  const setPlacement = useCallback(
    (key: string, placement: Placement, payload?: { groupId: string; optionId: string; label: string; priceDelta: number }) => {
      if (payload) {
        ensureAddon(key, payload, placement);
      } else {
        setAddons((prev) => {
          if (!prev[key]) return prev;
          return { ...prev, [key]: { ...prev[key], placement } };
        });
      }
    },
    [ensureAddon]
  );

  /**
   * For options without half: toggle select/unselect.
   * Single-select: replace any existing selection in the group. Multi: add/remove up to maxSelected.
   * For options with half: handled by setPlacement via tristate buttons.
   */
  const handleChipClick = useCallback(
    (key: string, groupId: string, item: OptionItem, supportsHalf: boolean, group: OptionGroup) => {
      if (supportsHalf) return; // Tristate handles it
      const priceDelta = item.priceDelta ?? item.priceModifier ?? 0;
      const payload = { groupId, optionId: item.id, label: item.name, priceDelta };

      setAddons((prev) => {
        if (prev[key]) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        if (group.selectionType === 'single') {
          const withoutGroup = Object.fromEntries(
            Object.entries(prev).filter(([, v]) => v.groupId !== groupId)
          );
          return { ...withoutGroup, [key]: { key, ...payload, placement: 'WHOLE' as Placement } };
        }
        const countInGroup = Object.values(prev).filter((v) => v.groupId === groupId).length;
        if (countInGroup >= group.maxSelected) return prev;
        return { ...prev, [key]: { key, ...payload, placement: 'WHOLE' as Placement } };
      });
    },
    []
  );

  return (
    <div className="space-y-2">
      {optionGroups.map((group) => (
        <div key={group.id} className="space-y-2">
          <label className="block text-sm font-medium" style={{ color: '#0a0a0a' }}>
            {group.name}
            {group.required && <span className="text-red-500 me-1">*</span>}
          </label>

          <div className="flex flex-wrap gap-2" dir="rtl">
            {(group.items ?? []).map((item) => {
              const key = `${group.id}::${item.id}`;
              const supportsHalf = optionSupportsHalf(item, group);
              const selected = key in addons;
              const placement = addons[key]?.placement ?? 'WHOLE';
              const stock = getOptionStock(product, group.id, item.id);
              const disabled = stock === 0;

              const priceDelta = item.priceDelta ?? item.priceModifier ?? 0;
              const priceStr = priceDelta > 0 ? ` +${formatMoney(priceDelta)}` : '';

              const payload = { groupId: group.id, optionId: item.id, label: item.name, priceDelta };

              if (supportsHalf) {
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 py-2 px-4 rounded-full bg-white transition-colors"
                    style={{ border: '1px solid rgba(15,118,110,0.2)' }}
                    role="group"
                    aria-labelledby={`topping-label-${key}`}
                  >
                    <span id={`topping-label-${key}`} className="text-sm font-medium shrink-0" style={{ color: '#0a0a0a' }}>
                      {item.name}{priceStr}
                    </span>
                    <div className="flex items-center gap-1" dir="ltr">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setPlacement(key, 'LEFT', selected ? undefined : payload)}
                        className={`p-2 rounded-full transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        style={{
                          backgroundColor: selected && placement === 'LEFT' ? TEAL : 'transparent',
                          color: selected && placement === 'LEFT' ? '#ffffff' : TEAL,
                        }}
                        title="النصف الأيسر"
                        aria-label={`${item.name} - النصف الأيسر`}
                        aria-pressed={selected && placement === 'LEFT'}
                      >
                        <LeftHalfCircleIcon className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setPlacement(key, 'WHOLE', selected ? undefined : payload)}
                        className={`p-2 rounded-full transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        style={{
                          backgroundColor: selected && placement === 'WHOLE' ? TEAL : 'transparent',
                          color: selected && placement === 'WHOLE' ? '#ffffff' : TEAL,
                        }}
                        title="البيتسا كاملة"
                        aria-label={`${item.name} - البيتسا كاملة`}
                        aria-pressed={selected && placement === 'WHOLE'}
                      >
                        <WholeCircleIcon className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setPlacement(key, 'RIGHT', selected ? undefined : payload)}
                        className={`p-2 rounded-full transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        style={{
                          backgroundColor: selected && placement === 'RIGHT' ? TEAL : 'transparent',
                          color: selected && placement === 'RIGHT' ? '#ffffff' : TEAL,
                        }}
                        title="النصف الأيمن"
                        aria-label={`${item.name} - النصف الأيمن`}
                        aria-pressed={selected && placement === 'RIGHT'}
                      >
                        <RightHalfCircleIcon className="w-5 h-5" />
                      </button>
                    </div>
                    {selected && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeAddon(key)}
                        className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs py-1 px-2"
                      >
                        إزالة
                      </Button>
                    )}
                  </div>
                );
              }

              return (
                <div key={key} className="relative">
                  <div
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onClick={() => !disabled && handleChipClick(key, group.id, item, supportsHalf, group)}
                    onKeyDown={(e) => {
                      if (disabled) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleChipClick(key, group.id, item, supportsHalf, group);
                      }
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={{
                      backgroundColor: selected ? TEAL : '#ffffff',
                      color: selected ? '#ffffff' : '#0a0a0a',
                      border: selected ? 'none' : '1px solid rgba(15,118,110,0.2)',
                    }}
                  >
                    <span>{item.name}{priceStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
