import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';
import { fetchProductById } from '../api/dummyjson';

export default function FavoritesPage() {
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const addToCart = useStore((s) => s.addToCart);
  const navigate = useNavigate();

  const queries = useQueries({
    queries: favorites.map((id) => ({
      queryKey: ['product', id],
      queryFn: async () => (await fetchProductById(id)) ?? null, // null = real 404; a throw = network error
      staleTime: 5 * 60 * 1000,
      retry: 1,
    })),
  });

  const loading = queries.some((q) => q.isPending);
  const failedCount = queries.filter((q) => q.isError).length;
  const items = queries.map((q) => q.data).filter(Boolean);
  const missingCount = favorites.length - items.length - failedCount; // ids that returned a real 404

  const retryFailed = () => queries.forEach((q) => q.isError && q.refetch());

  const handleAdd = (p) => {
    const res = addToCart(p, 1);
    if (res.ok) toast.success(`Added ${p.name} to cart`);
    else if (res.reason === 'soldout') toast.error(`${p.name} is sold out`);
    else if (res.reason === 'limit') toast(`You already have the maximum (${res.limit}) in your cart`);
  };

  return (
    <div className="section-wrap">
      <button className="icon-btn back-btn" onClick={() => navigate('/')}>
        ← Back to Shop
      </button>
      <h2>Your Saved Items</h2>

      {favorites.length === 0 ? (
        <p className="text-muted margin-top-20">No items saved yet.</p>
      ) : loading && items.length === 0 ? (
        <p className="text-muted" role="status">Loading saved items...</p>
      ) : items.length === 0 && failedCount > 0 ? (
        <div className="error-state" role="alert">
          <p>Couldn't load your saved items. Check your connection and try again.</p>
          <button type="button" className="load-more-btn" onClick={retryFailed}>
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted margin-top-20">
          Your saved items are no longer available.
        </p>
      ) : (
        <>
          {failedCount > 0 && (
            <div className="error-inline" role="alert">
              {failedCount} saved {failedCount === 1 ? 'item' : 'items'} couldn't be loaded.{' '}
              <button type="button" onClick={retryFailed}>Try again</button>
            </div>
          )}
          {missingCount > 0 && (
            <p className="text-muted">
              {missingCount} saved {missingCount === 1 ? 'item is' : 'items are'} no longer available.
            </p>
          )}
          <div className="grid margin-top-20">
            {items.map((p) => (
              <div key={p.id} className="card">
                <div
                  className="card-img-wrap"
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${p.name}`}
                  onClick={() => navigate(`/product/${p.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/product/${p.id}`);
                    }
                  }}
                >
                  <img src={p.thumbnail} alt={p.name} />
                  <button
                    type="button"
                    className="card-fav active"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(p.id);
                      toast('Removed from favorites');
                    }}
                    aria-label="Remove from favorites"
                  >
                    ♥
                  </button>
                </div>
                <div className="card-body">
                  <div className="card-title">{p.name}</div>
                  <div className="card-price-row">
                    <span className="price-now">${Number(p.price).toFixed(2)}</span>
                    <button type="button" className="add-btn" onClick={() => handleAdd(p)}>
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}