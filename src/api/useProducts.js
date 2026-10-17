import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchCategories, fetchProducts, fetchProductById } from './dummyjson';

const LIMIT = 12;

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => fetchCategories({ signal }),
    staleTime: 1000 * 60 * 60,
  });
}

export function useProduct(id) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: ({ signal }) => fetchProductById(id, { signal }),
    enabled: Boolean(id),
  });
}

export function useInfiniteProducts({ query, category, sort }) {
  return useInfiniteQuery({
    queryKey: ['products', 'infinite', { query, category, sort }],
    queryFn: ({ pageParam, signal }) =>
      fetchProducts({ query, category, sort, skip: pageParam * LIMIT, limit: LIMIT, signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, pg) => sum + pg.products.length, 0);
      return loaded < lastPage.total ? allPages.length : undefined;
    },
    placeholderData: keepPreviousData, // v5 syntax: no skeleton flash on filter/sort change
    retry: 1,
  });
}