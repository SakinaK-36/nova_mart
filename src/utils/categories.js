export const CHIP_COLORS = ['#00F0FF', '#FF2E88', '#B6FF3C', '#8A2EFF', '#FFD23F', '#FF6B35'];

export function getCategoryColor(categories, catId) {
  const i = categories.findIndex((x) => x.id === catId);
  return CHIP_COLORS[(i < 0 ? 0 : i) % CHIP_COLORS.length];
}