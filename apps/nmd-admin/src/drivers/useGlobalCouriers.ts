import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { fetchAllMarketCouriers, fetchMarketOptions } from './fetchAllMarketCouriers';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export function useGlobalCouriers(withStats = true) {
  return useQuery({
    queryKey: ['global-couriers', withStats],
    queryFn: () => fetchAllMarketCouriers(api, { withStats }),
    enabled: !!MOCK_API_URL,
    staleTime: 20_000,
  });
}

export function useMarketOptions() {
  return useQuery({
    queryKey: ['market-options'],
    queryFn: fetchMarketOptions,
    enabled: !!MOCK_API_URL,
    staleTime: 60_000,
  });
}

export function useGlobalCouriersApi() {
  return api;
}
