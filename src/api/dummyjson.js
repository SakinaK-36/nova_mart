const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
const TIMEOUT_MS = 30000;

function withTimeout(signal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return signal && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([signal, timeout])
    : timeout;
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal: withTimeout(signal) });
  if (!res.ok) {
    const err = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function normalizeProduct(p) {
  return {
    id: p.id,
    name: p.title,
    price: Number(p.price) || 0,
    was: p.compareAt ?? null, // a real "compare at" price, or null
    rating: p.rating,
    category: p.category,
    thumbnail: p.thumbnail,
    images: p.images?.length ? p.images : [p.thumbnail],
    desc: p.description,
    stock: p.stock ?? null,
  };
}

export async function fetchCategories({ signal } = {}) {
  const data = await getJson(`${API_BASE}/api/categories`, signal);
  return data.map((c) => ({ id: c.slug, label: c.name }));
}

export async function fetchProducts({
  query = '',
  category = 'All',
  sort = 'featured',
  skip = 0,
  limit = 12,
  signal,
}) {
  const params = new URLSearchParams({ limit: String(limit), skip: String(skip), sort });
  if (query.trim()) params.set('q', query.trim());
  else if (category !== 'All') params.set('category', category);

  const data = await getJson(`${API_BASE}/api/products?${params}`, signal);
  return { products: data.products.map(normalizeProduct), total: data.total };
}

export async function fetchProductById(id, { signal } = {}) {
  if (!/^\d+$/.test(String(id))) return null;
  try {
    const p = await getJson(`${API_BASE}/api/products/${encodeURIComponent(id)}`, signal);
    return normalizeProduct(p);
  } catch (err) {
    if (err.status === 404) return null; // genuinely not found
    throw err;                           // network/server errors surface to the UI
  }
}