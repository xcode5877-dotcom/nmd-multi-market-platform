import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Category, Product, OptionGroup } from '@nmd/core';
import { MockApiClient } from '@nmd/mock';
import { createAdminData } from '../store/admin-data';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

/** Returns admin catalog data. When VITE_MOCK_API_URL is set, uses shared API; otherwise uses localStorage. */
export function useAdminData(tenantId: string) {
  const queryClient = useQueryClient();
  const { data: catalog, isLoading } = useQuery({
    queryKey: ['catalog', tenantId],
    queryFn: () => api.getCatalogApi(tenantId),
    enabled: !!tenantId && USE_API,
  });

  const setCatalogMutation = useMutation({
    mutationFn: (updates: { categories?: Category[]; products?: Product[]; optionGroups?: OptionGroup[] }) =>
      api.setCatalogApi(tenantId, {
        categories: updates.categories ?? catalog?.categories ?? [],
        products: updates.products ?? catalog?.products ?? [],
        optionGroups: updates.optionGroups ?? catalog?.optionGroups ?? [],
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', tenantId] }),
  });

  if (!USE_API) {
    const adminData = createAdminData(tenantId);
    return {
      getCategories: () => adminData.getCategories(),
      getProducts: () => adminData.getProducts(),
      getOptionGroups: () => adminData.getOptionGroups(),
      setCategories: adminData.setCategories,
      setProducts: adminData.setProducts,
      setOptionGroups: adminData.setOptionGroups,
      isLoading: false,
    };
  }

  return {
    getCategories: () => (catalog?.categories ?? []) as Category[],
    getProducts: () => (catalog?.products ?? []) as Product[],
    getOptionGroups: () => ((catalog?.optionGroups ?? []) as OptionGroup[]),
    setCategories: (cats: Category[]) =>
      setCatalogMutation.mutate({
        categories: cats,
        products: (catalog?.products ?? []) as Product[],
        optionGroups: (catalog?.optionGroups ?? []) as OptionGroup[],
      }),
    setProducts: (prods: Product[]) =>
      setCatalogMutation.mutate({
        categories: (catalog?.categories ?? []) as Category[],
        products: prods,
        optionGroups: (catalog?.optionGroups ?? []) as OptionGroup[],
      }),
    setOptionGroups: (groups: OptionGroup[]) =>
      setCatalogMutation.mutate({
        categories: catalog?.categories ?? [],
        products: catalog?.products ?? [],
        optionGroups: groups,
      }),
    isLoading,
  };
}
