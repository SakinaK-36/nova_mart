import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCategories, useInfiniteProducts } from '../api/useProducts';
import { useStore } from '../store/useStore';
import { getCategoryColor } from '../utils/categories';
import { formatCategory } from '../utils/format';

import Hero from '../components/Hero';
import CategoryChips from '../components/CategoryChips';
import ProductCard from '../components/ProductCard';

function ProductSkeletonGrid() {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-block skeleton-img" />
          <div className="skeleton-block skeleton-line" style={{ width: '60%' }} />
          <div className="skeleton-block skeleton-line" style={{ width: '85%' }} />
          <div className="skeleton-block skeleton-line" style={{ width: '40%' }} />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCat = searchParams.get('category') || 'All';
  const queryParam = searchParams.get('q') || '';
  const sortParam = searchParams.get('sort') || 'featured';
    const canceled = searchParams.get('canceled');

  // Stripe sends buyers back to /?canceled=true. Tell them, then clean the URL.
  useEffect(() => {
    if (!canceled) return;
    toast('Checkout canceled. Your cart is still saved.', { id: 'checkout-canceled' });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('canceled');
        return next;
      },
      { replace: true }
    );
  }, [canceled, setSearchParams]);

  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const addToCart = useStore((s) => s.addToCart); const { data: categories = [] } = useCategories();

  const {
    data,
    isLoading,
    isError,
    isPlaceholderData,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteProducts({ query: queryParam, category: selectedCat, sort: sortParam });

  const products = useMemo(
    () => data?.pages.flatMap((pg) => pg.products) ?? [],
    [data]
  );
  const total = data?.pages?.[0]?.total || 0;

  // Capture the hero collage once so filtering/sorting doesn't swap it.
  const [heroImages, setHeroImages] = useState([]);
  if (heroImages.length === 0 && products.length >= 4) {
    setHeroImages(products.slice(0, 4).map((p) => p.thumbnail));
  }

  const updateParam = (key, value) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== 'All') next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  };

  // Choosing a category leaves search mode (the API can't combine the two).
  const selectCategory = (catId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('q');
        if (catId && catId !== 'All') next.set('category', catId);
        else next.delete('category');
        return next;
      },
      { replace: true }
    );
  };

  const handleToggleFav = (p) => {
    const wasFav = favorites.includes(p.id);
    toggleFavorite(p.id);
    toast(wasFav ? 'Removed from favorites' : 'Saved to favorites ♥', { id: `fav-${p.id}` });
  };

  const handleAdd = (p) => {
    const res = addToCart(p, 1);
    const id = `cart-${p.id}`;
    if (res.ok) toast.success(`Added ${p.name} to cart`, { id });
    else if (res.reason === 'soldout') toast.error(`${p.name} is sold out`, { id });
    else if (res.reason === 'limit') toast(`You already have the maximum (${res.limit}) in your cart`, { id });
  };

  const categoryLabel =
    categories.find((c) => c.id === selectedCat)?.label ?? formatCategory(selectedCat);

  const fullError = isError && products.length === 0;
  const pageError = isError && products.length > 0;

  return (
    <>
      {!queryParam && <Hero collageImages={heroImages} />}

      <CategoryChips
        categories={categories}
        activeCategory={queryParam ? null : selectedCat}
        onSelectCategory={selectCategory}
      />

      <main id="catalog-grid" className="section-wrap">
        <div className="section-head">
          <div>
            <h2>
              {queryParam
                ? `Search results for "${queryParam}"`
                : selectedCat === 'All'
                  ? "Today's Drops"
                  : categoryLabel}
            </h2>
            {!isLoading && !fullError && (
              <div className="result-count" aria-live="polite">
                {total} {total === 1 ? 'item' : 'items'} found
              </div>
            )}
          </div>

          <label htmlFor="sort-select" className="sr-only">Sort products</label>
          <select
            id="sort-select"
            value={sortParam}
            onChange={(e) => updateParam('sort', e.target.value)}
          >
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        {isLoading ? (
          <ProductSkeletonGrid />
        ) : fullError ? (
          <div className="error-state" role="alert">
            <p>Failed to retrieve inventory. Check your connection.</p>
            <button type="button" className="load-more-btn" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : products.length === 0 ? (
          <div style={{ color: 'var(--gray)', padding: '40px 0' }}>
            No products found. Try a different search.
          </div>
        ) : (
          <div className={`grid ${isPlaceholderData ? 'is-stale' : ''}`}>
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                color={getCategoryColor(categories, p.category)}
                isFav={favorites.includes(p.id)}
                onToggleFav={handleToggleFav}
                onAdd={handleAdd}
              />
            ))}
          </div>
        )}

        {pageError && (
          <div className="error-inline" role="alert">
            Couldn't load more products.{' '}
            <button type="button" onClick={() => fetchNextPage()}>Try again</button>
          </div>
        )}

        {hasNextPage && !isLoading && !pageError && (
          <div className="load-more-wrap">
            <button
              type="button"
              className="load-more-btn"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </main>
    </>
  );
}