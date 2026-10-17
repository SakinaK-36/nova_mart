import { Link } from 'react-router-dom';
import { formatPrice, formatCategory, ratingLabel, starString } from '../utils/format';

export default function ProductCard({ product: p, color, isFav, onToggleFav, onAdd }) {
  const href = `/product/${p.id}`;
  const price = Number(p.price);
  const was = Number(p.was);
  const onSale = Number.isFinite(was) && was > price;
  const outOfStock = p.stock === 0;
  const lowStock = p.stock != null && p.stock > 0 && p.stock <= 10;

  return (
    <div className="card">
      <div className="card-img-wrap">
        <Link to={href} className="card-img-link" aria-label={`View ${p.name}`}>
          <img src={p.thumbnail} alt={p.name} loading="lazy" />
        </Link>

        {onSale && <div className="sale-ribbon">DEAL!</div>}

        <div className="tag" style={{ '--tag-color': color }}>
          <div className="tag-badge">{formatPrice(p.price)}</div>
        </div>

        {lowStock && <div className="stock-badge">Only {p.stock} left</div>}
        {outOfStock && <div className="stock-badge">Sold out</div>}

        <button
          type="button"
          className={`card-fav ${isFav ? 'active' : ''}`}
          onClick={() => onToggleFav(p)}
          aria-pressed={isFav}
          aria-label={isFav ? `Remove ${p.name} from favorites` : `Add ${p.name} to favorites`}
        >
          ♥
        </button>
      </div>

      <div className="card-body">
        <div className="card-cat">{formatCategory(p.category)}</div>

        <Link to={href} className="card-title-link">
          <div className="card-title">{p.name}</div>
        </Link>

        {p.rating ? (
          <div className="card-rating" role="img" aria-label={ratingLabel(p.rating)}>
            <span className="stars" aria-hidden="true">{starString(p.rating)}</span>
            <span aria-hidden="true">{Number(p.rating).toFixed(1)}</span>
          </div>
        ) : (
          <div className="card-rating card-rating-empty">No ratings yet</div>
        )}

        <div className="card-price-row">
          <div>
            <span className="price-now">{formatPrice(p.price)}</span>
            {onSale && <span className="price-was">{formatPrice(p.was)}</span>}
          </div>
          <button
            type="button"
            className="add-btn"
            disabled={outOfStock}
            onClick={() => onAdd(p)}
          >
            {outOfStock ? 'Sold out' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}