import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchProductById } from '../api/dummyjson';
import { useStore } from '../store/useStore';
import { formatCategory } from '../utils/format';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const addToCart = useStore((s) => s.addToCart);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const favorites = useStore((s) => s.favorites);

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: null, product: null, error: false });
  const [picked, setPicked] = useState({ id: null, img: '' });

  const requestKey = `${id}:${attempt}`;

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await fetchProductById(id);
        if (!ignore) setResult({ key: requestKey, product: data ?? null, error: false });
      } catch {
        if (!ignore) setResult({ key: requestKey, product: null, error: true });
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id, requestKey]);

  // Loading is derived: any time the id or retry counter changes, we're loading until the matching result arrives.
  const loading = result.key !== requestKey;
  const { product, error } = result;

  if (loading) {
    return (
      <div className="section-wrap" role="status" style={{ color: 'var(--gray)' }}>
        Loading item details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state section-wrap" role="alert">
        <p>Couldn't load this product. Check your connection and try again.</p>
        <button className="load-more-btn" onClick={() => setAttempt((a) => a + 1)}>
          Retry
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="section-wrap">
        Product not found. <button onClick={() => navigate('/')}>Return</button>
      </div>
    );
  }

  const selectedImg = picked.id === product.id ? picked.img : product.images?.[0] ?? '';
  const isFav = favorites.includes(product.id);
  const outOfStock = product.stock === 0;
  const price = Number(product.price);
  const was = Number(product.was);
  const onSale = Number.isFinite(was) && was > price;
  const savePct = onSale ? Math.round((1 - price / was) * 100) : 0;
  const lowStock = product.stock > 0 && product.stock <= 10;

  const handleAdd = () => {
    const res = addToCart(product, 1);
    if (res.ok) toast.success(`Added ${product.name} to cart`);
    else if (res.reason === 'soldout') toast.error(`${product.name} is sold out`);
    else if (res.reason === 'limit') toast(`You already have the maximum (${res.limit}) in your cart`);
  };

  return (
    <div className="section-wrap">
      <button className="icon-btn back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <title>{`${product.name} | NovaMart`}</title>
      <meta name="description" content={String(product.desc ?? '').slice(0, 155)} />

      <div className="pdp-grid">
        <div>
          <img
            src={selectedImg || product.thumbnail}
            alt={product.name}
            className="pdp-hero-img"
          />
          <div className="thumb-row">
            {product.images?.map((img, i) => (
              <button
                key={i}
                type="button"
                className={`thumb-btn ${selectedImg === img ? 'active' : ''}`}
                aria-label={`Show image ${i + 1} of ${product.name}`}
                aria-pressed={selectedImg === img}
                onClick={() => setPicked({ id: product.id, img })}
              >
                <img src={img} alt="" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="pdp-category">{formatCategory(product.category)}</span>          <h1 className="pdp-title">{product.name}</h1>
          <p className="pdp-desc">{product.desc}</p>
          <div className="mono price-now pdp-price">
            ${price.toFixed(2)}
            {onSale && <span className="price-was">${was.toFixed(2)}</span>}
            {onSale && <span className="pdp-save">Save {savePct}%</span>}
          </div>
          {lowStock && <p className="stock-note pdp-stock">Only {product.stock} left in stock</p>}

          <div className="pdp-actions">
            <button className="add-btn pdp-add-btn" disabled={outOfStock} onClick={handleAdd}>
              {outOfStock ? 'Sold out' : 'Add to Cart'}
            </button>
            <button
              className={`icon-btn ${isFav ? 'active' : ''}`}
              onClick={() => {
                toggleFavorite(product.id);
                toast(isFav ? 'Removed from favorites' : 'Saved to favorites ♥');
              }}
            >
              {isFav ? '♥ Saved' : '🤍 Save for later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}