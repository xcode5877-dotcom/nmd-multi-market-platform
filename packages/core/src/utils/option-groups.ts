import type { OptionGroup } from '../types/product.js';
import type { TenantStoreType } from '../types/tenant.js';

/**
 * Filter option groups by tenant type.
 * - FOOD: only CUSTOM groups (hide SIZE, COLOR entirely).
 * - CLOTHING: allow SIZE, COLOR, CUSTOM.
 * - GENERAL: allow all.
 */
export function filterOptionGroupsForTenant(
  tenantType: TenantStoreType | null | undefined,
  groups: OptionGroup[]
): OptionGroup[] {
  if (!tenantType || tenantType === 'GENERAL') return groups;
  if (tenantType === 'FOOD') {
    return groups.filter((g) => (g.type ?? 'CUSTOM') === 'CUSTOM');
  }
  return groups;
}
