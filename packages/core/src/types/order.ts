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
  /** Customer pin from Location Picker (lat/lng). */
  deliveryLocation?: { lat: number; lng: number };
  /** When set to 'gps', address was set via one-tap detect or last location (show "GPS Verified"). */
  deliveryAddressSource?: 'gps' | 'manual';
  delivery?: OrderDeliverySnapshot;
  /** Links multiple orders (e.g. multi-store cart) for customer tracking. */
  orderGroupId?: string;
  /** Applied coupon id (from validate); backend marks it used when order is created. */
  couponId?: string;
  /** Cart-level discount amount (sent with first order when coupon applies to whole cart). */
  couponDiscountAmount?: number;
}

export interface Order {
  id: string;
  tenantId: string;
  /** Courier manual / off-app entry when true. */
  isExternal?: boolean;
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
  /** Customer pin from Location Picker (lat/lng). Persisted for courier map and Google Maps. */
  deliveryLocation?: { lat: number; lng: number };
  /** 'gps' = one-tap detect or last location (show "GPS Verified" in Admin/Courier). */
  deliveryAddressSource?: 'gps' | 'manual';
  delivery?: OrderDeliverySnapshot;
  /** Links multiple orders (multi-store cart) for customer tracking. */
  orderGroupId?: string;
}
