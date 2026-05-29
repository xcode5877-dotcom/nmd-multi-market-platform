import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { fetchDriverOpsOverview } from './fetchDriverOpsOverview';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export function useDriverOpsOverview(refetchIntervalMs = 30_000) {
  return useQuery({
    queryKey: ['driver-ops-overview'],
    queryFn: () => fetchDriverOpsOverview(api),
    enabled: !!MOCK_API_URL,
    refetchInterval: refetchIntervalMs,
    staleTime: 15_000,
  });
}
