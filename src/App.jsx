import { useEffect, useState } from 'react';
import { Routes, Route, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';

import Header from './components/Header';
import CartDrawer from './components/CartDrawer';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import OrdersPage from './pages/OrdersPage';
import FavoritesPage from './pages/FavoritesPage';

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const queryParam = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(queryParam);
  const [prevQueryParam, setPrevQueryParam] = useState(queryParam);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync the input when the URL's `q` changes from outside (back/forward, links).
  // Skip if the URL already matches what's typed, so trailing spaces survive.
  if (queryParam !== prevQueryParam) {
    setPrevQueryParam(queryParam);
    if (queryParam !== searchInput.trim()) setSearchInput(queryParam);
  }

  const writeQueryToUrl = useDebouncedCallback((value) => {
    const trimmed = value.trim();
    setSearchParams(
      (prev) => {
        if ((prev.get('q') || '') === trimmed) return prev;
        const next = new URLSearchParams(prev);
        if (trimmed) next.set('q', trimmed);
        else next.delete('q');
        return next;
      },
      { replace: true }
    );
  }, 350);

  // Drop any pending URL write when the route changes.
  useEffect(() => {
    writeQueryToUrl.cancel();
  }, [pathname, writeQueryToUrl]);

  const handleSearchChange = (value) => {
    setSearchInput(value);

    if (pathname !== '/') {
      writeQueryToUrl.cancel();
      const trimmed = value.trim();
      navigate({
        pathname: '/',
        search: trimmed ? `?${new URLSearchParams({ q: trimmed })}` : '',
      });
      return;
    }
    writeQueryToUrl(value);
  };

  return (
    <div>
      <div className="topbar">Free delivery on your first order · Easy 7-day returns</div>

      <Header
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        onOpenCart={() => setIsCartOpen(true)}
      />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
      </Routes>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-col">
            <div className="footer-brand">NOVA<span>MART</span></div>
            <p>Everyday tech and home essentials, delivered fast.</p>
          </div>
          <div className="footer-col">
            <h4>Shop</h4>
            <Link to="/">All products</Link>
            <Link to="/favorites">Favorites</Link>
            <Link to="/orders">Your orders</Link>
          </div>
          <div className="footer-col">
            <h4>Help</h4>
            <p>Delivery &amp; returns</p>
            <p>Contact us</p>
          </div>
        </div>
        <div className="footer-legal">© {new Date().getFullYear()} NovaMart. All rights reserved.</div>
      </footer>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}