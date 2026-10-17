import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';

const { STRIPE_SECRET_KEY, CLIENT_URL, PORT = 5000, NODE_ENV } = process.env;
const DEMO_MODE = process.env.DEMO_MODE === 'true';

if (!CLIENT_URL) {
  console.error('Missing CLIENT_URL in environment');
  process.exit(1);
}
// DEMO_MODE takes no payments. In production it must be switched on deliberately,
// for a public demo store that is clearly labelled as such.
if (DEMO_MODE && NODE_ENV === 'production' && process.env.ALLOW_PUBLIC_DEMO !== 'true') {
  console.error('DEMO_MODE in production requires ALLOW_PUBLIC_DEMO=true (this store takes no real payments).');
  process.exit(1);
}
if (!DEMO_MODE && !STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY (or set DEMO_MODE=true for local testing)');
  process.exit(1);
}

const clientUrl = CLIENT_URL.replace(/\/+$/, '');
const stripe = DEMO_MODE ? null : new Stripe(STRIPE_SECRET_KEY);

// ---- Catalog (your own data, see scripts/seed.js) ----
function loadJson(name) {
  try {
    return JSON.parse(readFileSync(new URL(`./data/${name}`, import.meta.url), 'utf8'));
  } catch {
    console.error(`Could not read server/data/${name}. Run "node scripts/seed.js" from the server folder first.`);
    process.exit(1);
  }
}
const CATALOG = loadJson('products.json');
const CATEGORIES = loadJson('categories.json');
const BY_ID = new Map(CATALOG.map((p) => [String(p.id), p]));

const toPublic = (p) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  category: p.category,
  brand: p.brand,
  price: p.priceCents / 100,
  compareAt: p.compareAtCents ? p.compareAtCents / 100 : null,
  stock: p.stock,
  rating: p.rating,
  thumbnail: p.thumbnail,
  images: p.images,
});

// ---- Business rules (keep in sync with the client) ----
const MAX_PER_ITEM = 10;
const MAX_LINES = 20;
const SHIPPING_CENTS = 599;
const FREE_SHIPPING_MIN_CENTS = 5000; // judged on the pre-discount subtotal, like the drawer
const SHIPPING_NAME = 'Standard shipping';
const COUPONS = {
  BOOM10: { type: 'percent', value: 10 },
  BOOM20: { type: 'percent', value: 20 },
  FREESHIP: { type: 'freeship', value: 0 },
};

// Demo mode only: orders kept in memory, lost on restart.
const DEMO_ID = /^demo_[a-f0-9]{24}$/;
const demoOrders = new Map();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function handleError(res, err) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.code === 'resource_missing') return res.status(404).json({ error: 'Not found' });
  console.error(err); // full detail stays in the server log
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) {
    throw new HttpError(400, 'Invalid cart');
  }
  const merged = new Map();
  for (const it of raw) {
    const id = String(it?.id);
    const qty = Number(it?.qty);
    if (!/^\d{1,6}$/.test(id) || !Number.isInteger(qty) || qty < 1) {
      throw new HttpError(400, 'Invalid cart item');
    }
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }
  return [...merged].map(([id, qty]) => ({ id, qty }));
}

const app = express();
// Behind a host's proxy (Render, Railway, ...), set TRUST_PROXY=1 so rate limits see real client IPs.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.use(helmet());
app.use(cors({ origin: clientUrl, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '10kb' }));

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
const checkoutLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);

// ---- Catalog routes ----
app.get('/api/categories', (_req, res) => {
  res.json(CATEGORIES);
});

app.get('/api/products', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const category = String(req.query.category ?? '');
  const sort = String(req.query.sort ?? 'featured');
  const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

  let list = CATALOG;
  if (q) {
    list = list.filter((p) =>
      `${p.title} ${p.brand ?? ''} ${p.category} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(q)
    );
  }
  if (category && category !== 'All') list = list.filter((p) => p.category === category);

  if (sort === 'price-asc') list = [...list].sort((a, b) => a.priceCents - b.priceCents);
  if (sort === 'price-desc') list = [...list].sort((a, b) => b.priceCents - a.priceCents);
  if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);

  res.json({ products: list.slice(skip, skip + limit).map(toPublic), total: list.length });
});

app.get('/api/products/:id', (req, res) => {
  const p = BY_ID.get(String(req.params.id));
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(toPublic(p));
});

// ---- Checkout ----
app.post('/api/create-checkout-session', checkoutLimiter, async (req, res) => {
  try {
    const items = parseItems(req.body?.items);

    // Coupon: validated here, never trusted from the client.
    const rawCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode.trim().toUpperCase() : '';
    let coupon = null;
    if (rawCode) {
      if (!Object.hasOwn(COUPONS, rawCode)) throw new HttpError(400, 'Invalid promo code');
      coupon = { code: rawCode, ...COUPONS[rawCode] };
    }

    // Prices, names, images and stock all come from the catalog, not the request.
    const lines = items.map(({ id, qty }) => {
      const p = BY_ID.get(id);
      if (!p) throw new HttpError(400, `Product ${id} is no longer available. Please remove it from your cart.`);
      if (!Number.isInteger(p.priceCents) || p.priceCents <= 0) {
        throw new HttpError(400, `${p.title} is unavailable`);
      }
      const limit = Math.min(Number.isFinite(p.stock) ? p.stock : Infinity, MAX_PER_ITEM);
      if (limit <= 0) throw new HttpError(409, `${p.title} is sold out`);
      if (qty > limit) throw new HttpError(409, `Only ${limit} of ${p.title} available`);
      return { qty, name: p.title, image: p.thumbnail, priceCents: p.priceCents };
    });

    // All money math in integer cents.
    const percent = coupon?.type === 'percent' ? coupon.value : 0;
    const priced = lines.map((l) => ({
      ...l,
      unitCents: Math.round((l.priceCents * (100 - percent)) / 100),
    }));
    const subtotalCents = lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
    const chargedCents = priced.reduce((s, l) => s + l.unitCents * l.qty, 0);
    const discountCents = subtotalCents - chargedCents;
    const shippingCents =
      subtotalCents >= FREE_SHIPPING_MIN_CENTS || coupon?.type === 'freeship' ? 0 : SHIPPING_CENTS;

    // ---- Demo mode: same checks and math as above, but no payment is taken ----
    if (DEMO_MODE) {
      const id = `demo_${randomBytes(12).toString('hex')}`;
      demoOrders.set(id, {
        orderNo: `NM-${id.slice(-8).toUpperCase()}`,
        date: new Date().toISOString(),
        items: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.priceCents / 100 })),
        subtotal: subtotalCents / 100,
        discount: discountCents / 100,
        shipping: shippingCents / 100,
        coupon: coupon?.code ?? null,
        total: (chargedCents + shippingCents) / 100,
      });
      if (demoOrders.size > 500) demoOrders.delete(demoOrders.keys().next().value);
      return res.json({ url: `${clientUrl}/orders?session_id=${id}` });
    }

    if (chargedCents + shippingCents < 50) {
      throw new HttpError(400, 'Order total is below the minimum charge');
    }

    const line_items = priced.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: 'usd',
        unit_amount: l.unitCents,
        // Stripe needs absolute, public image URLs.
        product_data: { name: l.name, images: /^https:\/\//.test(l.image ?? '') ? [l.image] : [] },
      },
    }));
    if (shippingCents > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: shippingCents,
          product_data: { name: SHIPPING_NAME },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${clientUrl}/orders?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/?canceled=true`,
      metadata: {
        coupon: coupon?.code ?? '',
        subtotal_cents: String(subtotalCents),
        discount_cents: String(discountCents),
        shipping_cents: String(shippingCents),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    handleError(res, err);
  }
});

// Called by the client after redirecting back. Only a paid session (or a demo session) yields an order.
app.get('/api/checkout-session/:id', checkoutLimiter, async (req, res) => {
  try {
    const id = String(req.params.id);

    if (DEMO_MODE && DEMO_ID.test(id)) {
      const order = demoOrders.get(id);
      if (!order) throw new HttpError(404, 'Order not found');
      return res.json({ paid: true, demo: true, order });
    }

    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) throw new HttpError(400, 'Invalid session id');
    if (DEMO_MODE) throw new HttpError(400, 'Stripe sessions are disabled in demo mode');

    const session = await stripe.checkout.sessions.retrieve(id);
    if (session.payment_status !== 'paid') return res.status(402).json({ paid: false });

    const { data } = await stripe.checkout.sessions.listLineItems(id, { limit: 100 });
    const m = session.metadata ?? {};
    const dollars = (cents) => (Number(cents) || 0) / 100;

    res.json({
      paid: true,
      order: {
        orderNo: `NM-${session.id.slice(-8).toUpperCase()}`,
        date: new Date(session.created * 1000).toISOString(),
        items: data
          .filter((li) => li.description !== SHIPPING_NAME)
          .map((li) => ({
            name: li.description,
            qty: li.quantity,
            price: dollars(li.price?.unit_amount),
          })),
        subtotal: dollars(m.subtotal_cents),
        discount: dollars(m.discount_cents),
        shipping: dollars(m.shipping_cents),
        coupon: m.coupon || null,
        total: dollars(session.amount_total),
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// JSON 404 and error handlers. They must come after every route.
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`NovaMart API running on http://localhost:${PORT} (${CATALOG.length} products)`);
  if (DEMO_MODE) console.warn('DEMO MODE: no payments are taken.');
});