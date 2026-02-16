import { listTenants } from './tenant-registry';
import { createCampaign } from './campaign-store';

export function seedCampaigns(): void {
  const tenants = listTenants();
  const existing = loadCampaigns();
  if (existing.length > 0) return;

  const pizza = tenants.find((t) => t.slug === 'pizza');
  const groceries = tenants.find((t) => t.slug === 'groceries');

  if (pizza) {
    createCampaign({
      tenantId: pizza.id,
      name: 'خصم البيتزا',
      status: 'active',
      type: 'PERCENT',
      value: 15,
      appliesTo: 'ALL',
      stackable: false,
      priority: 1,
    });
  }
  if (groceries) {
    createCampaign({
      tenantId: groceries.id,
      name: 'خصم ثابت',
      status: 'active',
      type: 'FIXED',
      value: 5,
      appliesTo: 'ALL',
      stackable: false,
      priority: 1,
    });
  }
}

function loadCampaigns(): { id: string }[] {
  try {
    const raw = localStorage.getItem('nmd.campaigns');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
