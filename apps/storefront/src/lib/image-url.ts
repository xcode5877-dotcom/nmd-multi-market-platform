/**
 * Resolve image URLs so that relative paths (e.g. /uploads/...) are loaded from the API origin.
 * After DB migration, logoUrl/imageUrl from the API may be relative; the storefront is served
 * from the same domain but /uploads is served at /api/uploads, so we need to prepend the API base.
 */
const API_BASE = import.meta.env.VITE_MOCK_API_URL ?? '';

export function resolveImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  // Already absolute
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Relative path: serve from API so /uploads/... works
  if (trimmed.startsWith('/') && API_BASE) {
    const base = API_BASE.replace(/\/$/, '');
    return `${base}${trimmed}`;
  }
  return trimmed;
}
