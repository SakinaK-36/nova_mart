import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function Header({ searchInput, onSearchChange, onOpenCart }) {
  const cart = useStore((s) => s.cart);
  const favorites = useStore((s) => s.favorites);
  const cartItemCount = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  return (
    <header className="main">
      <div className="header-row">
        <Link to="/" className="logo">
          NOVA<span>MART</span>
        </Link>
        <div className="search-wrap" role="search">
          <label htmlFor="site-search" className="sr-only">Search products</label>
          <input
            id="site-search"
            type="text"
            placeholder="Search products..."
            autoComplete="off"
            enterKeyHint="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="header-actions">
          <Link
            to="/favorites"
            className="icon-btn no-underline"
            aria-label={`Favorites${favorites.length ? `, ${favorites.length} saved` : ''}`}
          >
            <span aria-hidden="true">🤍</span> Favorites
            {favorites.length > 0 && (
              <span className="cart-count">{favorites.length}</span>
            )}
          </Link>
          <Link to="/orders" className="icon-btn no-underline">
            <span aria-hidden="true">🧾</span> Orders
          </Link>
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenCart}
            aria-label={`Open cart${cartItemCount > 0 ? `, ${cartItemCount} items` : ''}`}
          >
            <span aria-hidden="true">🛒</span> Cart
            {cartItemCount > 0 && (
              <span className="cart-count">{cartItemCount}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}