/** Super-admin managed modifier icon library entry (market-scoped in market-config). */
export interface ModifierIcon {
  id: string;
  /** Stable slug used on OptionItem.modifierIconKey (e.g. olive, mushroom). */
  key: string;
  labelAr: string;
  labelHe?: string;
  labelEn?: string;
  /** Uploaded CDN URL; empty → client uses bundled asset for [key]. */
  iconUrl: string;
  keywords: string[];
  category?: string;
  active: boolean;
  sortOrder: number;
}
