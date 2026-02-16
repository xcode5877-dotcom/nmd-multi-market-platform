import { z } from 'zod';

/** Per-tenant delivery zone. No minOrder. */
export const DeliveryZoneSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  fee: z.number(),
  etaMinutes: z.number().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().optional(),
});

export type DeliveryZone = z.infer<typeof DeliveryZoneSchema>;

/** Snapshot stored with order for delivery details. */
export interface OrderDeliverySnapshot {
  method: 'PICKUP' | 'DELIVERY';
  zoneId?: string;
  zoneName?: string;
  fee?: number;
  addressText?: string;
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
