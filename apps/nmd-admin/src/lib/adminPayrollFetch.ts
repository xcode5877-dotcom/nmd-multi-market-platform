const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export function getAdminToken(): string | null {
  return localStorage.getItem('nmd-access-token');
}

export async function adminPayrollFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${MOCK_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function openPayslipPdf(settlementId: string): Promise<void> {
  const token = getAdminToken();
  const res = await fetch(
    `${MOCK_API_URL}/admin/payroll-settlements/${encodeURIComponent(settlementId)}/payslip`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
    }
  );
  if (!res.ok) throw new Error('Failed to load payslip');
  const html = await res.text();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
