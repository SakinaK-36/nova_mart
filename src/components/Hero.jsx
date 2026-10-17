export default function Hero({ collageImages = [] }) {
  const handleScrollToGrid = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById('catalog-grid')
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section className="hero">
      <div>
        <h1>
          Shop the <span className="accent">future.</span>
          <br />
          Delivered to the <span className="accent2">present.</span>
        </h1>
        <p>
          Hand-picked tech, home and lifestyle essentials, delivered to your door.
          Search, save your favorites and check out in one click.
        </p>
        <button type="button" className="hero-cta" onClick={handleScrollToGrid}>
          Explore drops →
        </button>
      </div>

      <div className="hero-collage" aria-hidden="true">
        <div className="collage-grid">
          {Array.from({ length: 4 }).map((_, i) =>
            collageImages[i] ? (
              <img key={i} src={collageImages[i]} alt="" />
            ) : (
              <div key={i} className="skeleton-block collage-placeholder" />
            )
          )}
        </div>
      </div>
    </section>
  );
}