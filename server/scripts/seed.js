import { writeFile, mkdir, access, copyFile } from 'node:fs/promises';

// Six clear departments instead of ~25 mixed categories.
const DEPARTMENTS = [
  { slug: 'electronics', name: 'Electronics', from: ['smartphones', 'laptops', 'tablets', 'mobile-accessories'] },
  { slug: 'fashion', name: 'Fashion', from: ['mens-shirts', 'tops', 'womens-dresses', 'mens-shoes', 'womens-shoes'] },
  { slug: 'accessories', name: 'Accessories', from: ['mens-watches', 'womens-watches', 'sunglasses', 'womens-bags', 'womens-jewellery'] },
  { slug: 'home', name: 'Home & Living', from: ['furniture', 'home-decoration', 'kitchen-accessories'] },
  { slug: 'beauty', name: 'Beauty', from: ['beauty', 'skin-care', 'fragrances'] },
  { slug: 'sports', name: 'Sports', from: ['sports-accessories'] },
];
const PER_DEPARTMENT = 10;

// Safety: never overwrite a catalog that may contain hand edits.
const dataDir = new URL('../data/', import.meta.url);
const productsFile = new URL('products.json', dataDir);
const alreadySeeded = await access(productsFile).then(() => true, () => false);
if (alreadySeeded && !process.argv.includes('--force')) {
  console.error(
    'server/data/products.json already exists, so seeding would overwrite your edits.\n' +
    'Run "node scripts/seed.js --force" if you really want to start over (a backup is saved first).'
  );
  process.exit(1);
}

// "Was" price a little above the real price, ending in .99. Only used for demo sale items.
const markUp = (cents) => {
  const v = Math.round((cents * 1.25) / 100) * 100 - 1;
  return v > cents ? v : null;
};

if (alreadySeeded) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await copyFile(productsFile, new URL(`products.backup-${stamp}.json`, dataDir));
  console.log('Existing catalog backed up in server/data/');
}

const res = await fetch('https://dummyjson.com/products?limit=0');
if (!res.ok) throw new Error(`DummyJSON returned ${res.status}`);
const { products } = await res.json();

const catalog = [];
const departments = [];

for (const dept of DEPARTMENTS) {
  const picks = products
    .filter((p) => dept.from.includes(p.category))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, PER_DEPARTMENT);

  for (const p of picks) {
    const priceCents = Math.round(Number(p.price) * 100);
    if (!(priceCents > 0)) continue;

    catalog.push({
      id: p.id,
      title: p.title,
      description: p.description,
      category: dept.slug,
      brand: p.brand ?? null,
      priceCents,
      // Demo data: every 5th product is on sale.
      compareAtCents: p.id % 5 === 0 ? markUp(priceCents) : null,
      // Demo data: every 17th is sold out, every 11th is low stock, so those states get exercised.
      stock: p.id % 17 === 0 ? 0 : p.id % 11 === 0 ? 3 : Number.isFinite(p.stock) ? p.stock : 50,
      rating: p.rating,
      thumbnail: p.thumbnail,
      images: p.images?.length ? p.images : [p.thumbnail],
      tags: p.tags ?? [],
    });
  }
  if (picks.length) departments.push({ slug: dept.slug, name: dept.name });
  console.log(`${dept.name}: ${picks.length} products`);
}

// "Featured" order: best-rated first, mixed across departments.
catalog.sort((a, b) => b.rating - a.rating || a.id - b.id);

await mkdir(dataDir, { recursive: true });
await writeFile(productsFile, JSON.stringify(catalog, null, 2));
await writeFile(new URL('categories.json', dataDir), JSON.stringify(departments, null, 2));
console.log(`\nWrote ${catalog.length} products to server/data/`);