import type { Template } from '@nmd/core';

const STORAGE_KEY = 'nmd.templates';

function load(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function save(templates: Template[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function listTemplates(): Template[] {
  return load();
}

export function getTemplate(id: string): Template | null {
  return load().find((t) => t.id === id) ?? null;
}

export function seedTemplates(): void {
  const existing = load();
  if (existing.length > 0) return;

  const templates: Template[] = [
    { id: 't-minimal', name: 'بسيط', layoutStyle: 'minimal' },
    { id: 't-cozy', name: 'مريح', layoutStyle: 'cozy' },
    { id: 't-bold', name: 'واضح', layoutStyle: 'bold' },
    { id: 't-modern', name: 'حديث', layoutStyle: 'modern' },
  ];
  save(templates);
}
