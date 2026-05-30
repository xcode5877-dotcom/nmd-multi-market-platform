import type { Market } from './store.js';
import type { PlatformFeeConfig } from './platform-fee.js';

/** Stored inside Market.branding JSON until a dedicated DB column exists. */
export const MARKET_PLATFORM_FEE_BRANDING_KEY = 'platformFeeConfig';

export function parseMarketBrandingColumn(raw: string | null): {
  branding: Market['branding'];
  platformFeeConfig?: PlatformFeeConfig;
} {
  if (!raw) return { branding: undefined, platformFeeConfig: undefined };
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const feeRaw = parsed[MARKET_PLATFORM_FEE_BRANDING_KEY];
  const { [MARKET_PLATFORM_FEE_BRANDING_KEY]: _fee, ...brandingFields } = parsed;
  const branding =
    Object.keys(brandingFields).length > 0
      ? (brandingFields as NonNullable<Market['branding']>)
      : undefined;
  const platformFeeConfig =
    feeRaw != null && typeof feeRaw === 'object'
      ? (feeRaw as PlatformFeeConfig)
      : undefined;
  return { branding, platformFeeConfig };
}

export function serializeMarketBrandingColumn(market: Pick<Market, 'branding' | 'platformFeeConfig'>): string | null {
  const branding = market.branding ?? {};
  const hasBrandingFields = Object.keys(branding).length > 0;
  const hasFee = market.platformFeeConfig != null;
  if (!hasBrandingFields && !hasFee) return null;
  return JSON.stringify({
    ...branding,
    ...(hasFee ? { [MARKET_PLATFORM_FEE_BRANDING_KEY]: market.platformFeeConfig } : {}),
  });
}
