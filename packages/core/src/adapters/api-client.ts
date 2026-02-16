/**
 * API Client interface - abstract layer for backend integration.
 * Implement this with real HTTP client when backend is ready.
 */
import type {
  Tenant,
  Category,
  Product,
  Order,
  OrderPayload,
  Campaign,
  DeliverySettings,
  DeliveryZone,
  OptionGroup,
  OptionItem,
} from '../types';

export interface ApiClient {
  getTenant(tenantId: string): Promise<Tenant | null>;
  getMenu(tenantId: string): Promise<Category[]>;
  getProduct(tenantId: string, productId: string): Promise<Product | null>;
  getProducts(tenantId: string, categoryId?: string): Promise<Product[]>;
  createOrder(tenantId: string, payload: OrderPayload): Promise<Order>;
  getOrder(orderId: string): Promise<Order | null>;
  getCampaigns(tenantId: string): Promise<Campaign[]>;
  getDeliverySettings(tenantId: string): Promise<DeliverySettings | null>;
  getDeliveryZones(tenantId: string): Promise<DeliveryZone[]>;
  getOptionGroups(tenantId: string): Promise<OptionGroup[]>;
  getOptionItems(tenantId: string, groupId: string): Promise<OptionItem[]>;
}
