import type { StaffUser } from '@nmd/core';
import { generateId } from '@nmd/core';
import { listTenants } from './tenant-registry';

const STORAGE_KEY = 'nmd.staff';

function load(): StaffUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function save(staff: StaffUser[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
}

export function listStaff(tenantId: string): StaffUser[] {
  return load().filter((s) => s.tenantId === tenantId);
}

export function addStaff(input: Omit<StaffUser, 'id' | 'createdAt'>): StaffUser {
  const user: StaffUser = {
    ...input,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  const all = load();
  all.push(user);
  save(all);
  return user;
}

export function updateStaff(id: string, updates: Partial<Omit<StaffUser, 'id' | 'tenantId' | 'createdAt'>>): StaffUser | null {
  const all = load();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  save(all);
  return all[idx];
}

export function removeStaff(id: string): void {
  save(load().filter((s) => s.id !== id));
}

export function seedStaff(): void {
  const existing = load();
  if (existing.length > 0) return;

  const tenants = listTenants();
  const now = new Date().toISOString();
  const staff: StaffUser[] = tenants.map((t) => ({
    id: generateId(),
    tenantId: t.id,
    name: `مالك ${t.name}`,
    role: 'OWNER' as const,
    createdAt: now,
  }));
  save(staff);
}
