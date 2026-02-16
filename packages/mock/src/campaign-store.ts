import type { Campaign } from '@nmd/core';

const STORAGE_KEY = 'nmd.campaigns';

function load(): Campaign[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function save(data: Campaign[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function listCampaigns(tenantId: string): Campaign[] {
  return load().filter((c) => c.tenantId === tenantId);
}

export function getCampaign(id: string): Campaign | null {
  return load().find((c) => c.id === id) ?? null;
}

export function createCampaign(input: Omit<Campaign, 'id'>): Campaign {
  const id = crypto.randomUUID?.() ?? `camp-${Date.now()}`;
  const campaign: Campaign = { ...input, id };
  const data = load();
  data.push(campaign);
  save(data);
  return campaign;
}

export function updateCampaign(id: string, updates: Partial<Omit<Campaign, 'id'>>): Campaign | null {
  const data = load();
  const idx = data.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...updates } as Campaign;
  save(data);
  return data[idx];
}

export function deleteCampaign(id: string): boolean {
  const data = load().filter((c) => c.id !== id);
  if (data.length === load().length) return false;
  save(data);
  return true;
}

export function toggleCampaignStatus(id: string): Campaign | null {
  const c = getCampaign(id);
  if (!c) return null;
  const next = c.status === 'active' ? 'paused' : 'active';
  return updateCampaign(id, { status: next });
}
