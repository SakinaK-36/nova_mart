import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useStore, limitFor } from '../store/useStore';
import { formatPrice } from '../utils/format';

const toCents = (n) => Math.round(Number(n) * 100);

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';


export default function CartDrawer({ isOpen, onClose }) {
  const cart = useStore((s) => s.cart);
  const coupon = useStore((s) => s.coupon);
  const setCartQty = useStore((s) => s.setCartQty);
  const applyCoupon = useStore((s) => s.applyCoupon);
  const removeCoupon = useStore((s) => s.removeCoupon);
  const [promoInput, setPromoInput] = useState('');
  const closeBtnRef = useRef(null);
  const entries = Object.values(cart);
  const [paying, setPaying] = useState(false);

  const pct = coupon?.type === 'percent' ? coupon.value : 0;
  const subtotalCents = entries.reduce((sum, { product, qty }) => sum + toCents(product.price) * qty, 0);
  // Same per-unit rounding the server uses, so the drawer matches what is actually charged.
  const chargedCents = entries.reduce(
    (sum, { product, qty }) => sum + Math.round((toCents(product.price) * (100 - pct)) / 100) * qty,
    0
  );
  const shippingCents =
    subtotalCents === 0 || subtotalCents >= 5000 || coupon?.type === 'freeship' ? 0 : 599;
  const subtotal = subtotalCents / 100;
  const discount = (subtotalCents - chargedCents) / 100;
  const shipping = shippingCents / 100;
  const total = (chargedCents + shippingCents) / 100;

  // Escape closes the drawer.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Lock page scroll and move focus into the drawer while it's open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const opener = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [isOpen]);

  const handleApplyPromo = (e) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const res = applyCoupon(promoInput.trim());
    if (res.success) {
      toast.success(`Coupon applied: ${res.label}`);
      setPromoInput('');
    } else {
      toast.error(res.msg || 'Invalid promo code');
    }
  };

  const handleCheckout = async () => {
    if (!entries.length || paying) return;
    setPaying(true);
    try {
      const res = await fetch(`${API_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: entries.map(({ product, qty }) => ({ id: product.id, qty })),
          couponCode: coupon?.code ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Checkout failed');
      window.location.assign(data.url);
    } catch (err) {
      toast.error(err.message || 'Could not start checkout');
      setPaying(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="overlay"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          >
            <div className="drawer-head">
              <h3 id="cart-title">Your Cart</h3>
              <button type="button" ref={closeBtnRef} onClick={onClose} aria-label="Close cart">
                ✕
              </button>
            </div>

            <div className="drawer-body">
              {entries.length === 0 ? (
                <p style={{ color: 'var(--gray)', textAlign: 'center', marginTop: '60px' }}>
                  Your cart is empty.<br />Add an item to get started.
                </p>
              ) : (
                entries.map(({ product, qty }) => {
                  const max = limitFor(product);
                  return (
                    <div key={product.id} className="cart-item">
                      <img src={product.thumbnail} alt="" />
                      <div className="cart-item-info">
                        <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{product.name}</span>
                        <div className="qty-row">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${product.name}`}
                            onClick={() => setCartQty(product.id, Math.max(0, qty - 1))}
                          >
                            –
                          </button>
                          <span className="mono" aria-live="polite">{qty}</span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${product.name}`}
                            disabled={qty >= max}
                            onClick={() => setCartQty(product.id, Math.min(max, qty + 1))}
                          >
                            +
                          </button>
                        </div>
                        {qty >= max && (
                          <span className="stock-note">Limit reached: {max}</span>
                        )}
                        <button
                          type="button"
                          className="remove-link"
                          aria-label={`Remove ${product.name} from cart`}
                          onClick={() => {
                            setCartQty(product.id, 0);
                            toast('Item removed from cart');
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mono price-now">{formatPrice(product.price * qty)}</div>
                    </div>
                  );
                })
              )}
            </div>

            {entries.length > 0 && (
              <div className="drawer-foot">
                {coupon ? (
                  <div className="coupon-applied">
                    <span>🎟️ {coupon.code} ({coupon.label})</span>
                    <button type="button" onClick={removeCoupon}>Remove</button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyPromo} className="coupon-row">
                    <label htmlFor="promo-input" className="sr-only">Promo code</label>
                    <input
                      id="promo-input"
                      type="text"
                      placeholder="Promo code"
                      autoComplete="off"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                    />
                    <button type="submit">Apply</button>
                  </form>
                )}

                <div className="summary-line">
                  <span>Subtotal</span>
                  <span className="mono">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="summary-line discount">
                    <span>Discount</span>
                    <span className="mono">−{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="summary-line">
                  <span>Shipping</span>
                  <span className="mono">{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
                </div>
                <div className="summary-line total">
                  <span>Total</span>
                  <span className="mono">{formatPrice(total)}</span>
                </div>
                <button type="button" className="checkout-btn" onClick={handleCheckout} disabled={paying}>
                  {paying ? 'Redirecting…' : 'Checkout →'}                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}