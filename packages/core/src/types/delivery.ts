import { z } from 'zod';

/** Per-tenant delivery zone. No minOrder. Geo-radius: center + radiusKm for distance-based pricing. */
export const DeliveryZoneSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  fee: z.number(),
  etaMinutes: z.number().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().optional(),
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
  radiusKm: z.number().optional(),
});

export type DeliveryZone = z.infer<typeof DeliveryZoneSchema>;

/** Customer delivery pin (lat/lng from checkout map). */
export interface DeliveryLocation {
  lat: number;
  lng: number;
}

/** Snapshot stored with order for delivery details. */
export interface OrderDeliverySnapshot {
  method: 'PICKUP' | 'DELIVERY';
  zoneId?: string;
  zoneName?: string;
  fee?: number;
  addressText?: string;
  /** Customer pin from Location Picker (for courier map and Google Maps). */
  deliveryLocation?: DeliveryLocation;
  /** 'gps' = address set via detect/last location (GPS Verified). */
  deliveryAddressSource?: 'gps' | 'manual';
}

export const DeliverySettingsSchema = z.object({
  tenantId: z.string(),
  modes: z.object({
    pickup: z.boolean(),
    delivery: z.boolean(),
  }),
  deliveryFee: z.number().optional(),
  zones: z.array(DeliveryZoneSchema).optional(),
});

export type DeliverySettings = z.infer<typeof DeliverySettingsSchema>;
