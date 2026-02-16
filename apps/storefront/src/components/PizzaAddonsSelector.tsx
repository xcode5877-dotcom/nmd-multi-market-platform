import { useState, useCallback, useEffect, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { ChevronDown } from 'lucide-react';
import { Button } from '@nmd/ui';
import { formatMoney, PLACEMENT_LABELS_AR, PLACEMENT_OPTIONS_AR, type PizzaPlacement } from '@nmd/core';
import type { Product, OptionGroup, OptionItem } from '@nmd/core';

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
  const [openKey, setOpenKey] = useState<string | null>(null);

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
    (key: string, payload: { groupId: string; optionId: string; label: string; priceDelta: number }) => {
      const group = optionGroups.find((g) => g.id === payload.groupId);
      if (!group) return;

      setAddons((prev) => {
        if (prev[key]) return prev;

        return {
          ...prev,
          [key]: { key, ...payload, placement: 'WHOLE' as Placement },
        };
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

  /** Set placement for existing addon. Merges only. */
  const setPlacement = useCallback((key: string, placement: Placement) => {
    setAddons((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: { ...prev[key], placement } };
    });
  }, []);

  /**
   * Chip click:
   * - For options without half placement: toggle select/unselect (UNLIMITED).
   * - For options with half placement: ensure selected then open popover.
   * NEVER clears or replaces addons.
   */
  const handleChipClick = useCallback(
    (key: string, groupId: string, item: OptionItem, supportsHalf: boolean) => {
      const priceDelta = item.priceDelta ?? item.priceModifier ?? 0;
      const payload = { groupId, optionId: item.id, label: item.name, priceDelta };

      if (!supportsHalf) {
        setAddons((prev) => {
          if (prev[key]) {
            const next = { ...prev };
            delete next[key];
            return next;
          }
          return { ...prev, [key]: { key, ...payload, placement: 'WHOLE' as Placement } };
        });
        return;
      }

      ensureAddon(key, payload);
      setOpenKey(key);
    },
    [ensureAddon]
  );

  const handleIconClick = useCallback((e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    setOpenKey(key);
  }, []);

  return (
    <div className="space-y-2">
      {optionGroups.map((group) => (
        <div key={group.id} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {group.name}
            {group.required && <span className="text-red-500 me-1">*</span>}
          </label>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto" dir="rtl">
            {(group.items ?? []).map((item) => {
              const key = `${group.id}::${item.id}`;
              const supportsHalf = optionSupportsHalf(item, group);
              const selected = key in addons;
              const placement = addons[key]?.placement ?? 'WHOLE';
              const stock = getOptionStock(product, group.id, item.id);
              const disabled = stock === 0;

              const priceDelta = item.priceDelta ?? item.priceModifier ?? 0;
              const priceStr = priceDelta > 0 ? ` +${formatMoney(priceDelta)}` : '';

              const chipLabel =
                selected && supportsHalf
                  ? `${item.name} • ${PLACEMENT_LABELS_AR[placement] ?? placement}`
                  : `${item.name}${priceStr}`;

              const chipContent = (
                <div
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  onClick={() => !disabled && handleChipClick(key, group.id, item, supportsHalf)}
                  onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleChipClick(key, group.id, item, supportsHalf);
                    }
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    selected
                      ? 'bg-primary text-white border border-primary shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span>{chipLabel}</span>

                  {selected && supportsHalf && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleIconClick(e, key)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="inline-flex p-0.5 rounded-full hover:bg-white/20"
                      aria-label="تغيير الموضع"
                    >
                      <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
                    </span>
                  )}
                </div>
              );

              if (supportsHalf) {
                return (
                  <Popover.Root
                    key={key}
                    open={openKey === key}
                    onOpenChange={(open) => {
                      setOpenKey(open ? key : null);
                    }}
                    modal={false}
                  >
                    <Popover.Anchor asChild>
                      <div className="inline-flex">{chipContent}</div>
                    </Popover.Anchor>

                    <Popover.Portal>
                      <Popover.Content
                        dir="rtl"
                        className="z-[9999] min-w-[10rem] rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
                        sideOffset={6}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        {addons[key] && (
                          <>
                            <RadioGroup.Root
                              value={addons[key].placement}
                              onValueChange={(v) => v && setPlacement(key, v as Placement)}
                              className="flex flex-col gap-1"
                            >
                              {PLACEMENT_OPTIONS_AR.map((opt) => (
                                <label
                                  key={`${key}::${opt.value}`}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer ${
                                    addons[key].placement === opt.value
                                      ? 'bg-primary/10 text-primary'
                                      : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <RadioGroup.Item
                                    value={opt.value}
                                    id={`${key}-${opt.value}`}
                                    className="w-3.5 h-3.5 rounded-full border-2 border-primary data-[state=checked]:bg-primary"
                                  />
                                  <span className="text-sm">{opt.label}</span>
                                </label>
                              ))}
                            </RadioGroup.Root>

                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  removeAddon(key);
                                  setOpenKey(null);
                                }}
                                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                إزالة
                              </Button>
                            </div>
                          </>
                        )}
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                );
              }

              return (
                <div key={key} className="relative">
                  {chipContent}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
