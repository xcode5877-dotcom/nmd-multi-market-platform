import { z } from 'zod';

export const CampaignStatusSchema = z.enum(['draft', 'active', 'paused']);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const CampaignTypeSchema = z.enum(['PERCENT', 'FIXED', 'BUNDLE_PLACEHOLDER']);
export type CampaignType = z.infer<typeof CampaignTypeSchema>;

export const CampaignAppliesToSchema = z.enum(['ALL', 'CATEGORIES', 'PRODUCTS']);
export type CampaignAppliesTo = z.infer<typeof CampaignAppliesToSchema>;

export const CampaignSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  status: CampaignStatusSchema,
  type: CampaignTypeSchema,
  value: z.number(),
  appliesTo: CampaignAppliesToSchema,
  categoryIds: z.array(z.string()).optional(),
  productIds: z.array(z.string()).optional(),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  stackable: z.boolean().optional().default(false),
  priority: z.number().optional().default(0),
});

export type Campaign = z.infer<typeof CampaignSchema>;
