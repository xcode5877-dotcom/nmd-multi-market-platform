import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@nmd/core';
import { generateId } from '@nmd/core';

const EMPTY_ITEMS: CartItem[] = [];

interface CartState {
  carts: Record<string, CartItem[]>;
  lastAddTimestamp: number | undefined;
  addItem: (tenantId: string, item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (tenantId: string, itemId: string, quantity: number) => void;
  removeItem: (tenantId: string, itemId: string) => void;
  clearCart: (tenantId: string) => void;
  getItems: (tenantId: string) => CartItem[];
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      carts: {},
      lastAddTimestamp: undefined,
      addItem: (tenantId, item) =>
        set((state) => ({
          lastAddTimestamp: Date.now(),
          carts: {
            ...state.carts,
            [tenantId]: [...(state.carts[tenantId] ?? []), { ...item, id: generateId() }],
          },
        })),
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
                i.id === itemId ? { ...i, quantity, totalPrice: (i.totalPrice / i.quantity) * quantity } : i
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
        set((state) => ({
          carts: { ...state.carts, [tenantId]: [] },
        })),
      getItems: (tenantId) => get().carts[tenantId] ?? EMPTY_ITEMS,
    }),
    {
      name: 'nmd-cart',
      partialize: (s) => ({ carts: s.carts }),
    }
  )
);
