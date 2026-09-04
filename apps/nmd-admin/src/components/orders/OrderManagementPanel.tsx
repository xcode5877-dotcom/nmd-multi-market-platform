/**
 * Super Admin only — privileged order line-item management.
 * Never shown to MARKET_ADMIN / TENANT_ADMIN / customers.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Modal, useToast, Input, Select } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import type { OptionGroup, OrderManagementReason } from '@nmd/core';
import {
  canManageOrderItems,
  isOrderManagementEditable,
  getOrderManagementBlockReason,
  ORDER_MANAGEMENT_REASONS,
  ORDER_MGMT_REASON_LABELS,
} from '../../lib/order-management';
import OrderAddProductModal, { type AddProductResult } from './OrderAddProductModal';
import OrderModifiersEditor, { type SelectedOptionDraft } from './OrderModifiersEditor';
import { ChevronDown, ChevronUp, Minus, Plus, Pencil, StickyNote, Trash2 } from 'lucide-react';

const api = new MockApiClient();

type OrderItem = {
  id?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  basePrice?: number;
  totalPrice?: number;
  notes?: string;
  quantityStep?: number;
  selectedOptions?: SelectedOptionDraft[];
  optionGroups?: OptionGroup[];
};

type OrderLike = {
  id?: string;
  tenantId?: string;
  status?: string;
  notes?: string;
  currency?: string;
  subtotal?: number;
  total?: number;
  discountAmount?: number;
  items?: OrderItem[];
  delivery?: { fee?: number };
  modificationHistory?: Array<Record<string, unknown>>;
};

type Props = {
  order: OrderLike;
  userRole?: string;
  invalidateKeys?: string[][];
};

type PendingAction =
  | { kind: 'add'; payload: AddProductResult }
  | { kind: 'remove'; item: OrderItem }
  | { kind: 'qty'; item: OrderItem; quantity: number }
  | { kind: 'modifiers'; item: OrderItem; selectedOptions: SelectedOptionDraft[] }
  | { kind: 'itemNotes'; item: OrderItem; notes: string }
  | { kind: 'orderNotes'; notes: string };

export default function OrderManagementPanel({ order, userRole, invalidateKeys = [] }: Props) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const allowed = canManageOrderItems(userRole);
  const editable = isOrderManagementEditable(order.status);
  const blockReason = getOrderManagementBlockReason(order.status);
  const currency = order.currency ?? '₪';

  const [addOpen, setAddOpen] = useState(false);
  const [modItem, setModItem] = useState<OrderItem | null>(null);
  const [notesItem, setNotesItem] = useState<OrderItem | null>(null);
  const [itemNotesDraft, setItemNotesDraft] = useState('');
  const [orderNotesOpen, setOrderNotesOpen] = useState(false);
  const [orderNotesDraft, setOrderNotesDraft] = useState(order.notes ?? '');
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState<OrderManagementReason>('CORRECTION');
  const [reasonDetail, setReasonDetail] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedMod, setExpandedMod] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ['order-modifications', order.id],
    queryFn: () => api.getOrderModifications(order.id!),
    enabled: allowed && !!order.id && historyOpen,
  });

  const mutation = useMutation({
    mutationFn: async (action: PendingAction) => {
      if (!order.id) throw new Error('missing order id');
      let operations: Array<Record<string, unknown>> = [];
      if (action.kind === 'add') {
        operations = [
          {
            type: 'ADD_ITEM',
            productId: action.payload.productId,
            quantity: action.payload.quantity,
            selectedOptions: action.payload.selectedOptions,
            notes: action.payload.notes,
          },
        ];
      } else if (action.kind === 'remove') {
        operations = [{ type: 'REMOVE_ITEM', itemId: action.item.id }];
      } else if (action.kind === 'qty') {
        operations = [{ type: 'UPDATE_QUANTITY', itemId: action.item.id, quantity: action.quantity }];
      } else if (action.kind === 'modifiers') {
        operations = [
          {
            type: 'UPDATE_MODIFIERS',
            itemId: action.item.id,
            selectedOptions: action.selectedOptions,
          },
        ];
      } else if (action.kind === 'itemNotes') {
        operations = [{ type: 'UPDATE_ITEM_NOTES', itemId: action.item.id, notes: action.notes }];
      } else if (action.kind === 'orderNotes') {
        operations = [{ type: 'UPDATE_ORDER_NOTES', notes: action.notes }];
      }
      const expectedRevision =
        typeof (order as { revision?: number }).revision === 'number'
          ? (order as { revision: number }).revision
          : undefined;
      return api.manageOrder(order.id, {
        reason,
        reasonDetail: reasonDetail.trim() || undefined,
        operations,
        expectedRevision,
        idempotencyKey:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? `ui-${crypto.randomUUID()}`
            : `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
    },
    onSuccess: async () => {
      addToast('تم تحديث الطلب بنجاح', 'success');
      setPending(null);
      setReasonDetail('');
      setAddOpen(false);
      setModItem(null);
      setNotesItem(null);
      setOrderNotesOpen(false);
      const keys = [['order', order.id!], ['order-modifications', order.id!], ...invalidateKeys];
      await Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: k })));
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'فشل تحديث الطلب';
      addToast(msg, 'error');
    },
  });

  const pendingSummary = useMemo(() => {
    if (!pending) return '';
    if (pending.kind === 'add') {
      return `إضافة «${pending.payload.productName}» × ${pending.payload.quantity} (+${pending.payload.estimatedLineTotal} ${currency})`;
    }
    if (pending.kind === 'remove') {
      return `إزالة «${pending.item.productName}» × ${pending.item.quantity} (−${pending.item.totalPrice ?? 0} ${currency})`;
    }
    if (pending.kind === 'qty') {
      return `تغيير كمية «${pending.item.productName}» من ${pending.item.quantity} إلى ${pending.quantity}`;
    }
    if (pending.kind === 'modifiers') return `تعديل إضافات «${pending.item.productName}»`;
    if (pending.kind === 'itemNotes') return `تعديل ملاحظة الصنف «${pending.item.productName}»`;
    return 'تعديل ملاحظات الطلب';
  }, [pending, currency]);

  if (!allowed) return null;

  const items = order.items ?? [];
  const deliveryFee = order.delivery?.fee ?? 0;

  return (
    <section className="space-y-3 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">إدارة الطلب</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
          Super Admin
        </span>
      </div>

      {!editable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          التعديل غير متاح لهذه الحالة.
          <div className="mt-0.5 text-xs text-amber-700/90">{blockReason}</div>
        </div>
      )}

      {editable && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddOpen(true)}>
              إضافة منتج
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<StickyNote className="h-3.5 w-3.5" />}
              onClick={() => {
                setOrderNotesDraft(order.notes ?? '');
                setOrderNotesOpen(true);
              }}
            >
              ملاحظات الطلب
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((item) => {
              const id = String(item.id ?? '');
              const step = item.quantityStep ?? 1;
              const draftQty = qtyDrafts[id] ?? String(item.quantity ?? 1);
              return (
                <div
                  key={id || item.productName}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{item.productName ?? '—'}</div>
                      {item.notes?.trim() && (
                        <div className="mt-0.5 text-xs text-gray-500">ملاحظة: {item.notes}</div>
                      )}
                      <div className="mt-1 text-xs text-gray-500">
                        {item.totalPrice ?? 0} {currency}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded p-1.5 text-red-600 hover:bg-red-50"
                      title="إزالة"
                      onClick={() => setPending({ kind: 'remove', item })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1 rounded-md border border-gray-200">
                      <button
                        type="button"
                        className="px-2 py-1 hover:bg-gray-50"
                        onClick={() => {
                          const next = Math.max(step, (Number(item.quantity) || step) - step);
                          setPending({ kind: 'qty', item, quantity: next });
                        }}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        className="w-14 border-x border-gray-200 px-1 py-1 text-center text-sm outline-none"
                        value={draftQty}
                        onChange={(e) => setQtyDrafts((d) => ({ ...d, [id]: e.target.value }))}
                        onBlur={() => {
                          const n = Number(draftQty);
                          if (!Number.isFinite(n) || n <= 0) {
                            setQtyDrafts((d) => ({ ...d, [id]: String(item.quantity ?? 1) }));
                            return;
                          }
                          if (n !== item.quantity) setPending({ kind: 'qty', item, quantity: n });
                        }}
                      />
                      <button
                        type="button"
                        className="px-2 py-1 hover:bg-gray-50"
                        onClick={() => {
                          const next = (Number(item.quantity) || 0) + step;
                          setPending({ kind: 'qty', item, quantity: next });
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {(item.optionGroups?.length ?? 0) > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={() => setModItem(item)}
                      >
                        إضافات
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<StickyNote className="h-3.5 w-3.5" />}
                      onClick={() => {
                        setNotesItem(item);
                        setItemNotesDraft(item.notes ?? '');
                      }}
                    >
                      ملاحظة
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2 text-xs text-gray-600 space-y-0.5">
            <div className="flex justify-between">
              <span>المجموع الفرعي</span>
              <span>
                {order.subtotal ?? 0} {currency}
              </span>
            </div>
            {(order.discountAmount ?? 0) > 0 && (
              <div className="flex justify-between">
                <span>الخصم</span>
                <span>
                  −{order.discountAmount} {currency}
                </span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>التوصيل</span>
                <span>
                  {deliveryFee} {currency}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-800 pt-0.5 border-t border-gray-200">
              <span>الإجمالي</span>
              <span>
                {order.total ?? 0} {currency}
              </span>
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        onClick={() => setHistoryOpen((v) => !v)}
      >
        <span>سجل التعديلات</span>
        {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {historyOpen && (
        <div className="space-y-2">
          {historyQuery.isLoading && (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-amber-600" />
              جاري التحميل...
            </div>
          )}
          {(historyQuery.data?.modifications ?? order.modificationHistory ?? []).map(
            (mod: Record<string, unknown>) => {
            const mid = String(mod.id ?? mod.seq ?? '');
            const open = expandedMod === mid;
            const priceDiff = typeof mod.priceDifference === 'number' ? mod.priceDifference : null;
            return (
              <div key={mid} className="rounded-lg border border-gray-200 text-sm overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start hover:bg-gray-50"
                  onClick={() => setExpandedMod(open ? null : mid)}
                >
                  <div>
                    <div className="font-medium text-gray-800">
                      {mod.action === 'ORIGINAL' ? 'الطلب الأصلي' : `تعديل #${String(mod.seq ?? '')}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {mod.at ? new Date(String(mod.at)).toLocaleString('ar') : '—'}
                      {mod.reason ? ` · ${ORDER_MGMT_REASON_LABELS[String(mod.reason)] ?? String(mod.reason)}` : ''}
                    </div>
                  </div>
                  {priceDiff != null && mod.action !== 'ORIGINAL' && (
                    <span
                      className={`text-xs font-medium ${
                        priceDiff > 0
                          ? 'text-emerald-700'
                          : priceDiff < 0
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }`}
                    >
                      {priceDiff > 0 ? '+' : ''}
                      {priceDiff} {currency}
                    </span>
                  )}
                </button>
                {open && (
                  <div className="border-t border-gray-100 bg-gray-50/80 px-3 py-2 text-xs text-gray-600 space-y-1">
                    <div>الإجراء: {String(mod.actorRole ?? '—')} {mod.actorEmail ? `(${String(mod.actorEmail)})` : ''}</div>
                    {mod.reasonDetail ? <div>تفاصيل: {String(mod.reasonDetail)}</div> : null}
                    <div>الإجراء: {String(mod.action ?? '—')}</div>
                    <div>
                      الإجمالي:{' '}
                      {String((mod.before as { total?: number } | undefined)?.total ?? '—')} →{' '}
                      {String((mod.after as { total?: number } | undefined)?.total ?? '—')}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {(historyQuery.data?.modifications?.length ?? order.modificationHistory?.length ?? 0) === 0 &&
            !historyQuery.isLoading && (
              <p className="py-2 text-center text-xs text-gray-500">لا توجد تعديلات بعد</p>
            )}
        </div>
      )}

      {order.tenantId && (
        <OrderAddProductModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          tenantId={order.tenantId}
          currency={currency}
          onConfirm={(payload) => setPending({ kind: 'add', payload })}
        />
      )}

      <Modal
        open={!!modItem}
        onClose={() => setModItem(null)}
        title={`إضافات · ${modItem?.productName ?? ''}`}
        size="md"
      >
        {modItem && (
          <OrderModifiersEditor
            optionGroups={modItem.optionGroups ?? []}
            initial={(modItem.selectedOptions ?? []) as SelectedOptionDraft[]}
            onCancel={() => setModItem(null)}
            onConfirm={(selectedOptions) => {
              setPending({ kind: 'modifiers', item: modItem, selectedOptions });
              setModItem(null);
            }}
          />
        )}
      </Modal>

      <Modal open={!!notesItem} onClose={() => setNotesItem(null)} title="ملاحظة الصنف" size="sm">
        <div className="space-y-3">
          <Input value={itemNotesDraft} onChange={(e) => setItemNotesDraft(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNotesItem(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (!notesItem) return;
                setPending({ kind: 'itemNotes', item: notesItem, notes: itemNotesDraft });
                setNotesItem(null);
              }}
            >
              متابعة
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={orderNotesOpen} onClose={() => setOrderNotesOpen(false)} title="ملاحظات الطلب" size="sm">
        <div className="space-y-3">
          <textarea
            className="w-full min-h-[100px] rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={orderNotesDraft}
            onChange={(e) => setOrderNotesDraft(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOrderNotesOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => setPending({ kind: 'orderNotes', notes: orderNotesDraft })}>
              متابعة
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!pending}
        onClose={() => !mutation.isPending && setPending(null)}
        title="تأكيد التعديل"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{pendingSummary}</p>
          <Select
            label="السبب (مطلوب)"
            value={reason}
            onChange={(e) => setReason(e.target.value as OrderManagementReason)}
            options={ORDER_MANAGEMENT_REASONS.map((r) => ({ value: r.id, label: r.labelAr }))}
          />
          <Input
            label="تفاصيل إضافية (اختياري)"
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            placeholder="مثال: الزبون طلب تغيير الكمية"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" disabled={mutation.isPending} onClick={() => setPending(null)}>
              إلغاء
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() => pending && mutation.mutate(pending)}
            >
              {mutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جاري الحفظ...
                </span>
              ) : (
                'حفظ التعديل'
              )}
            </Button>
          </div>
        </div>
      </Modal>

    </section>
  );
}
