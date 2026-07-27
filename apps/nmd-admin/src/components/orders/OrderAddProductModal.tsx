/**
 * Add-product wizard for Super Admin order management.
 * Flow: Categories → Products → Modifiers → Review → Confirm
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Button, Input } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import type { Category, OptionGroup, Product } from '@nmd/core';
import OrderModifiersEditor, { type SelectedOptionDraft } from './OrderModifiersEditor';

const api = new MockApiClient();

type Step = 'categories' | 'products' | 'modifiers' | 'review';

export type AddProductResult = {
  productId: string;
  productName: string;
  quantity: number;
  selectedOptions: SelectedOptionDraft[];
  notes?: string;
  estimatedLineTotal: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  currency?: string;
  onConfirm: (result: AddProductResult) => void;
};

function estimateUnit(product: Product, selected: SelectedOptionDraft[]): number {
  let unit = Number(product.basePrice) || 0;
  const groups = product.optionGroups ?? [];
  for (const sel of selected) {
    const g = groups.find((x: OptionGroup) => x.id === sel.optionGroupId);
    for (const id of sel.optionItemIds ?? []) {
      const opt = g?.items?.find((i: { id: string }) => i.id === id);
      if (!opt) continue;
      const delta = opt.priceDelta ?? opt.priceModifier ?? 0;
      const p = sel.optionPlacements?.[id];
      unit += delta * (p === 'LEFT' || p === 'RIGHT' ? 0.5 : 1);
    }
  }
  return unit;
}

export default function OrderAddProductModal({ open, onClose, tenantId, currency = '₪', onConfirm }: Props) {
  const [step, setStep] = useState<Step>('categories');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptionDraft[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const { data: catalog, isLoading } = useQuery({
    queryKey: ['catalog', tenantId],
    queryFn: () => api.getCatalogApi(tenantId),
    enabled: open && !!tenantId,
  });

  const categories = useMemo(() => {
    const list = (catalog?.categories ?? []) as Category[];
    return list.filter((c) => (c as { isVisible?: boolean }).isVisible !== false);
  }, [catalog]);

  const products = useMemo(() => {
    const list = (catalog?.products ?? []) as Product[];
    return list.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (p.isArchived) return false;
      if (p.isAvailable === false) return false;
      if (search.trim()) {
        return p.name.toLowerCase().includes(search.trim().toLowerCase());
      }
      return true;
    });
  }, [catalog, categoryId, search]);

  const reset = () => {
    setStep('categories');
    setCategoryId(null);
    setProduct(null);
    setSelectedOptions([]);
    setQuantity(1);
    setNotes('');
    setSearch('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickCategory = (id: string) => {
    setCategoryId(id);
    setStep('products');
  };

  const pickProduct = (p: Product) => {
    setProduct(p);
    const groups = (p.optionGroups ?? []) as OptionGroup[];
    if (groups.some((g) => (g.items?.length ?? 0) > 0)) {
      setStep('modifiers');
    } else {
      setSelectedOptions([]);
      setStep('review');
    }
  };

  const unit = product ? estimateUnit(product, selectedOptions) : 0;
  const lineTotal = Math.round(unit * quantity * 100) / 100;
  const stepLabel =
    step === 'categories'
      ? 'التصنيفات'
      : step === 'products'
        ? 'المنتجات'
        : step === 'modifiers'
          ? 'الإضافات'
          : 'مراجعة';

  return (
    <Modal open={open} onClose={handleClose} title={`إضافة منتج · ${stepLabel}`} size="lg">
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-amber-600" />
          جاري تحميل الكتوست...
        </div>
      ) : (
        <div className="space-y-4">
          {step === 'categories' && (
            <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCategory(c.id)}
                  className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-3 text-sm font-medium text-gray-800 transition hover:border-amber-400 hover:bg-amber-50"
                >
                  {c.name ?? c.id}
                </button>
              ))}
              {categories.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-gray-500">لا توجد تصنيفات</p>
              )}
            </div>
          )}

          {step === 'products' && (
            <>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep('categories')}>
                  ← التصنيفات
                </Button>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث عن منتج..."
                  className="flex-1"
                />
              </div>
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 text-start text-sm transition hover:border-amber-300 hover:bg-amber-50/50"
                  >
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-gray-500">
                      {p.basePrice} {currency}
                    </span>
                  </button>
                ))}
                {products.length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-500">لا توجد منتجات</p>
                )}
              </div>
            </>
          )}

          {step === 'modifiers' && product && (
            <OrderModifiersEditor
              optionGroups={(product.optionGroups ?? []) as OptionGroup[]}
              onCancel={() => setStep('products')}
              confirmLabel="متابعة للمراجعة"
              onConfirm={(sel) => {
                setSelectedOptions(sel);
                setStep('review');
              }}
            />
          )}

          {step === 'review' && product && (
            <div className="space-y-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">المنتج</span>
                  <span className="font-medium">{product.name}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">الكمية</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-8 w-8 rounded border border-gray-200"
                      onClick={() => {
                        const step = Number(product.quantityStep ?? 1) || 1;
                        setQuantity((q) => Math.max(step, q - step));
                      }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className="w-16 rounded border border-gray-200 px-2 py-1 text-center text-sm"
                      value={quantity}
                      min={Number(product.quantityStep ?? 1) || 1}
                      step={Number(product.quantityStep ?? 1) || 1}
                      onChange={(e) => {
                        const step = Number(product.quantityStep ?? 1) || 1;
                        setQuantity(Math.max(step, Number(e.target.value) || 1));
                      }}
                    />
                    <button
                      type="button"
                      className="h-8 w-8 rounded border border-gray-200"
                      onClick={() => {
                        const step = Number(product.quantityStep ?? 1) || 1;
                        setQuantity((q) => q + step);
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
                  <span>التأثير على الإجمالي</span>
                  <span>
                    +{lineTotal} {currency}
                  </span>
                </div>
              </div>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظة على الصنف (اختياري)"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setStep((product.optionGroups?.length ?? 0) > 0 ? 'modifiers' : 'products')
                  }
                >
                  رجوع
                </Button>
                <Button
                  onClick={() => {
                    onConfirm({
                      productId: product.id,
                      productName: product.name,
                      quantity,
                      selectedOptions,
                      notes: notes.trim() || undefined,
                      estimatedLineTotal: lineTotal,
                    });
                    reset();
                  }}
                >
                  تأكيد الإضافة
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
