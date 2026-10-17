export function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
}

export function starString(rating = 0) {
  const full = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function ratingLabel(rating) {
  return `Rated ${Number(rating).toFixed(1)} out of 5`;
}

// Slugs whose display name is not just the capitalised slug. Keep in sync with server/data/categories.json.
const CATEGORY_LABELS = { home: 'Home & Living' };

export function formatCategory(slug = '') {
  if (Object.hasOwn(CATEGORY_LABELS, slug)) return CATEGORY_LABELS[slug];
  return String(slug)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}