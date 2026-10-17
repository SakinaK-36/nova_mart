import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_PER_ITEM = 10; // hard ceiling even if stock is higher or missing; adjust to taste
const MAX_ORDERS = 20;

const COUPONS = {
  BOOM10: { type: 'percent', value: 10, label: '10% off' },
  BOOM20: { type: 'percent', value: 20, label: '20% off' },
  FREESHIP: { type: 'freeship', value: 0, label: 'Free shipping' },
};

export const limitFor = (product) => {
  const stock = Number.isFinite(product?.stock) ? product.stock : Infinity;
  return Math.max(0, Math.min(stock, MAX_PER_ITEM));
};

const toWhole = (n) => Math.floor(Number(n));

export const useStore = create(
  persist(
    (set, get) => ({
      cart: {},
      favorites: [],
      orders: [],
      coupon: null,

      // Returns { ok, qty, limit, capped } or { ok: false, reason: 'invalid' | 'soldout' | 'limit', limit }
      addToCart: (product, qty = 1) => {
        const inc = toWhole(qty);
        if (!product || !(Number(product.price) > 0) || !Number.isFinite(inc) || inc <= 0) {
          return { ok: false, reason: 'invalid' };
        }
        const limit = limitFor(product);
        if (limit === 0) return { ok: false, reason: 'soldout', limit };
        const existing = get().cart[product.id]?.qty || 0;
        if (existing >= limit) return { ok: false, reason: 'limit', limit };
        const newQty = Math.min(existing + inc, limit);
        set((state) => ({
          cart: { ...state.cart, [product.id]: { qty: newQty, product } },
        }));
        return { ok: true, qty: newQty, limit, capped: existing + inc > limit };
      },

      setCartQty: (id, qty) =>
        set((state) => {
          const existing = state.cart[id];
          if (!existing) return state;
          const wanted = toWhole(qty);
          if (!Number.isFinite(wanted)) return state;
          const next = wanted <= 0 ? 0 : Math.min(wanted, limitFor(existing.product));
          const updated = { ...state.cart };
          if (next <= 0) delete updated[id];
          else updated[id] = { ...existing, qty: next };
          return { cart: updated };
        }),

      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((item) => item !== id)
            : [...state.favorites, id],
        })),

      applyCoupon: (code) => {
        const key = String(code ?? '').trim().toUpperCase();
        if (!key) return { success: false, msg: 'Enter a promo code' };
        if (!Object.hasOwn(COUPONS, key)) return { success: false, msg: 'Invalid promo code' };
        const match = COUPONS[key];
        set({ coupon: { code: key, ...match } });
        return { success: true, label: match.label };
      },

      removeCoupon: () => set({ coupon: null }),

      clearCart: () => set({ cart: {}, coupon: null }),

      recordOrder: (order) =>
        set((state) => ({ orders: [order, ...state.orders].slice(0, MAX_ORDERS) })),

      // Atomic: records the order and clears cart + coupon in one update.
      // Build `order` (items, subtotal, discount, shipping, coupon, total) BEFORE calling this.
      placeOrder: (order) =>
        set((state) => ({
          orders: [order, ...state.orders].slice(0, MAX_ORDERS),
          cart: {},
          coupon: null,
        })),
    }),
    {
      name: 'novamart-store',
      version: 1,
      migrate: (persisted) => persisted,
      partialize: (s) => ({
        cart: s.cart,
        favorites: s.favorites,
        orders: s.orders,
        coupon: s.coupon,
      }),
      // Re-validate whatever came out of localStorage instead of trusting it.
      merge: (persisted, current) => {
        const p = persisted ?? {};

        const cart = {};
        for (const [id, line] of Object.entries(p.cart ?? {})) {
          const product = line?.product;
          if (!product || !Number.isFinite(product.price)) continue;
          const qty = Math.min(toWhole(line.qty), limitFor(product));
          if (Number.isFinite(qty) && qty > 0) cart[id] = { qty, product };
        }

        const code = p.coupon?.code;
        const coupon =
          typeof code === 'string' && Object.hasOwn(COUPONS, code)
            ? { code, ...COUPONS[code] }
            : null;

        return {
          ...current,
          cart,
          coupon,
          favorites: Array.isArray(p.favorites) ? p.favorites : [],
          orders: Array.isArray(p.orders)
            ? p.orders.filter((o) => o && o.orderNo != null && Array.isArray(o.items))
            : [],
        };
      },
    }
  )
);