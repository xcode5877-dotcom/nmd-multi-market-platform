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
