import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@nmd/core';
import { generateId, roundMoney } from '@nmd/core';
import type { Product } from '@nmd/core';
import { repriceCartItemsFromCatalog } from '../lib/reprice-cart';

const EMPTY_ITEMS: CartItem[] = [];

/** Market group: same marketId = can mix in one cart. */
const ADDITIONAL_STORE_DELIVERY_FEE_NIS = 5;

interface CartState {
  carts: Record<string, CartItem[]>;
  /** tenantId -> marketId for multi-store same-market rule */
  tenantMarketIds: Record<string, string>;
  /** tenantId -> display name for floating cart label and summary */
  tenantNames: Record<string, string>;
  lastAddTimestamp: number | undefined;
  addItem: (tenantId: string, item: Omit<CartItem, 'id'>, marketId?: string, tenantName?: string) => void;
  updateQuantity: (tenantId: string, itemId: string, quantity: number) => void;
  removeItem: (tenantId: string, itemId: string) => void;
  clearCart: (tenantId: string) => void;
  getItems: (tenantId: string) => CartItem[];
  getTenantIdsInCart: () => string[];
  getCartMarketId: () => string | null;
  /** True if cart has stores from more than one market (different marketIds or mix with no market). */
  getCartHasMultipleMarkets: () => boolean;
  getStoreCountInCart: () => number;
  /** Store names in cart order for label (e.g. "مطعم أ + محل ب"). Falls back to tenantId slice if name missing. */
  getStoreNamesInCart: () => string[];
  /** Update customerUnitPrice/totalPrice from fresh catalog (platform fee changes). */
  repriceFromCatalog: (tenantId: string, products: Product[]) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      carts: {},
      tenantMarketIds: {},
      tenantNames: {},
      lastAddTimestamp: undefined,
      addItem: (tenantId, item, marketId, tenantName) => {
        const state = get();
        const tenantIds = Object.keys(state.carts).filter((id) => (state.carts[id]?.length ?? 0) > 0);
        if (tenantIds.length > 0 && !tenantIds.includes(tenantId)) return;
        set((s) => ({
          lastAddTimestamp: Date.now(),
          carts: {
            ...s.carts,
            [tenantId]: [...(s.carts[tenantId] ?? []), { ...item, id: generateId() }],
          },
          tenantMarketIds:
            marketId != null && marketId !== ''
              ? { ...s.tenantMarketIds, [tenantId]: marketId }
              : s.tenantMarketIds,
          tenantNames:
            tenantName != null && tenantName !== ''
              ? { ...s.tenantNames, [tenantId]: tenantName }
              : s.tenantNames,
        }));
      },
      updateQuantity: (tenantId, itemId, quantity) =>
        set((state) => {
          const items = state.carts[tenantId] ?? [];
          if (quantity <= 0) {
            return {
              carts: {
                ...state.carts,
                [tenantId]: items.filter((i) => i.id !== itemId),
              },
            };
          }
          return {
            carts: {
              ...state.carts,
              [tenantId]: items.map((i) =>
                i.id === itemId
                  ? { ...i, quantity, totalPrice: roundMoney((i.totalPrice / i.quantity) * quantity) }
                  : i
              ),
            },
          };
        }),
      removeItem: (tenantId, itemId) =>
        set((state) => ({
          carts: {
            ...state.carts,
            [tenantId]: (state.carts[tenantId] ?? []).filter((i) => i.id !== itemId),
          },
        })),
        clearCart: (tenantId) =>
        set((state) => {
          const { [tenantId]: _m, ...restMarkets } = state.tenantMarketIds;
          const { [tenantId]: _n, ...restNames } = state.tenantNames;
          return {
            carts: { ...state.carts, [tenantId]: [] },
            tenantMarketIds: restMarkets,
            tenantNames: restNames,
          };
        }),
      getItems: (tenantId) => get().carts[tenantId] ?? EMPTY_ITEMS,
      getTenantIdsInCart: () => {
        const carts = get().carts;
        return Object.keys(carts).filter((id) => (carts[id]?.length ?? 0) > 0);
      },
      getCartMarketId: () => {
        const ids = get().getTenantIdsInCart();
        if (ids.length === 0) return null;
        const marketIds = get().tenantMarketIds;
        return marketIds[ids[0]] ?? null;
      },
      getCartHasMultipleMarkets: () => {
        const ids = get().getTenantIdsInCart();
        if (ids.length <= 1) return false;
        const marketIds = get().tenantMarketIds;
        const values = ids.map((id) => marketIds[id] ?? '__none__');
        return new Set(values).size > 1;
      },
      getStoreCountInCart: () => get().getTenantIdsInCart().length,
      getStoreNamesInCart: () => {
        const ids = get().getTenantIdsInCart();
        const names = get().tenantNames;
        return ids.map((id) => names[id]?.trim() || id.slice(0, 8) || 'متجر');
      },
      repriceFromCatalog: (tenantId, products) => {
        const items = get().carts[tenantId] ?? [];
        if (items.length === 0 || products.length === 0) return;
        const repriced = repriceCartItemsFromCatalog(items, products);
        if (repriced === items) return;
        set((state) => ({
          carts: { ...state.carts, [tenantId]: repriced },
        }));
      },
    }),
    {
      name: 'nmd-cart',
      partialize: (s) => ({ carts: s.carts, tenantMarketIds: s.tenantMarketIds, tenantNames: s.tenantNames }),
    }
  )
);

export { ADDITIONAL_STORE_DELIVERY_FEE_NIS };
