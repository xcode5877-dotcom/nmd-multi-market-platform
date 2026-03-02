import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onTenantUpdate } from '../lib/tenant-broadcast';

/** Listens for cross-tab tenant updates (admin saves) and invalidates tenant queries */
export function TenantBroadcastListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return onTenantUpdate(() => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    });
  }, [queryClient]);

  return null;
}
