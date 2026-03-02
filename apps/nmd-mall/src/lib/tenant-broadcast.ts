/** Listen for cross-tab tenant updates (admin saves → refetch market tenants) */
const CHANNEL = 'nmd-tenant-update';

export function onTenantUpdate(callback: (tenantId: string) => void): () => void {
  const handler = (e: MessageEvent | CustomEvent) => {
    const tenantId = (e as MessageEvent).data?.tenantId ?? (e as CustomEvent).detail?.tenantId;
    if (tenantId) callback(tenantId);
  };
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = handler as (e: MessageEvent) => void;
    return () => bc.close();
  } catch {
    const h = (e: Event) => handler(e as CustomEvent);
    window.addEventListener(CHANNEL, h);
    return () => window.removeEventListener(CHANNEL, h);
  }
}
