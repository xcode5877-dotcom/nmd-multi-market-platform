import type { CartItem } from './cart';
import type { OrderDeliverySnapshot } from './delivery';

export type OrderFulfillmentType = 'PICKUP' | 'DELIVERY';

export type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE';

export interface OrderPayload {
  tenantId: string;
  items: CartItem[];
  fulfillmentType: OrderFulfillmentType;
  paymentMethod: PaymentMethod;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  delivery?: OrderDeliverySnapshot;
}

export interface Order {
  id: string;
  tenantId: string;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  fulfillmentType: OrderFulfillmentType;
  /** Multi-sector: PRODUCT | FOOD | SERVICE (default PRODUCT) */
  orderType?: 'PRODUCT' | 'FOOD' | 'SERVICE';
  paymentMethod: PaymentMethod;
  items: CartItem[];
  subtotal: number;
  total: number;
  currency: string;
  createdAt: string;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  delivery?: OrderDeliverySnapshot;
}
