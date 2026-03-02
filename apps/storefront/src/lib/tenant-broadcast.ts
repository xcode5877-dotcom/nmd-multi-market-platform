/** Broadcast channel for cross-tab tenant updates (admin saves → storefront/mall refetch) */
const CHANNEL = 'nmd-tenant-update';

export function broadcastTenantUpdate(tenantId: string): void {
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ tenantId });
    bc.close();
  } catch {
    window.dispatchEvent(new CustomEvent(CHANNEL, { detail: { tenantId } }));
  }
}

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
