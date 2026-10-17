import { CHIP_COLORS } from '../utils/categories';

const CATEGORY_ICONS = {
  beauty: '💄',
  fragrances: '🌸',
  furniture: '🛋️',
  groceries: '🛒',
  fashion: '👕',
  accessories: '⌚',
  home: '🛋️',
  'home-decoration': '🖼️',
  sports: '🏅',
  'kitchen-accessories': '🍳',
  kitchen: '🍳',
  laptops: '💻',
  'mens-shirts': '👔',
  'mens-shoes': '👞',
  'mens-watches': '⌚',
  'mobile-accessories': '🔌',
  motorcycle: '🏍️',
  'skin-care': '🧴',
  smartphones: '📱',
  'sports-accessories': '🏅',
  sunglasses: '🕶️',
  tablets: '📱',
  tops: '👚',
  vehicle: '🚗',
  'womens-bags': '👜',
  'womens-dresses': '👗',
  'womens-jewellery': '💍',
  'womens-shoes': '👠',
  'womens-watches': '⌚',
  office: '✏️',
  garden: '🪴',
  tools: '🔧',
  apparel: '🧦',
  electronics: '🔌',
  toys: '🧸',
};


export default function CategoryChips({ categories = [], activeCategory, onSelectCategory }) {
  return (
    <div className="catgrid" role="group" aria-label="Product categories">
      <button
        type="button"
        className={`chip ${activeCategory === 'All' ? 'active' : ''}`}
        onClick={() => onSelectCategory('All')}
        aria-pressed={activeCategory === 'All'}
      >
        <span className="chip-icon" style={{ background: '#00F0FF22' }} aria-hidden="true">
          ⚡
        </span>
        <span className="chip-label">All</span>
      </button>

      {categories.map((c, idx) => {
        const color = CHIP_COLORS[idx % CHIP_COLORS.length];
        const icon = CATEGORY_ICONS[c.id] || '🛍️';
        const active = activeCategory === c.id;
        return (
          <button
            type="button"
            key={c.id}
            className={`chip ${active ? 'active' : ''}`}
            onClick={() => onSelectCategory(c.id)}
            aria-pressed={active}
          >
            <span className="chip-icon" style={{ background: `${color}22` }} aria-hidden="true">
              {icon}
            </span>
            <span className="chip-label">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}