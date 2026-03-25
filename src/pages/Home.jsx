import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import EditorialSpread from '../components/EditorialSpread';
import Lightbox from '../components/Lightbox';
import { useRevealAll } from '../hooks/useReveal';
import { useViewCursor } from '../hooks/useViewCursor';
import { getImageUrl, getFallbackUrl } from '../utils/imageHelpers';
import photoData from '../data/photos.json';
import './Home.css';

const HERO_LINES = [
  { text: 'Remain', style: 'normal' },
  { text: 'And', style: 'stroke' },
  { text: 'Romantacise', style: 'em' },
];

const Home = () => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [heroReady, setHeroReady] = useState(false);
  const publishedPhotos = photoData.photos.filter(p => p.published !== false);
  const featuredPhotos = publishedPhotos.filter(p => p.featured);
  const heroPhoto = publishedPhotos.find(p => p.heroImage) || featuredPhotos[0];
  const heroRef = useRef(null);
  const [typed, setTyped] = useState(0);
  const [glitch, setGlitch] = useState(false);
  const glitchTimer = useRef(null);

  const allChars = HERO_LINES.flatMap((line, li) =>
    [...line.text].map((ch, ci) => ({ ch, style: line.style, line: li, idx: ci }))
  );
  const totalChars = allChars.length;

  useRevealAll();
  const { containerRef: catRef, cursorRef: catCursorRef } = useViewCursor();

  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  /* Typing effect — starts after hero reveals */
  useEffect(() => {
    if (!heroReady) return;
    if (typed < totalChars) {
      const char = allChars[typed];
      const isLineStart = char.idx === 0 && char.line > 0;
      const delay = isLineStart ? 300 : 55 + Math.random() * 50;
      const id = setTimeout(() => setTyped(t => t + 1), delay);
      return () => clearTimeout(id);
    }
  }, [heroReady, typed]);

  /* Periodic glitch bursts — only after typing is done */
  useEffect(() => {
    if (typed < totalChars) return;
    const trigger = () => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 1500);
      glitchTimer.current = setTimeout(trigger, 3000 + Math.random() * 5000);
    };
    glitchTimer.current = setTimeout(trigger, 1500);
    return () => clearTimeout(glitchTimer.current);
  }, [typed >= totalChars]);

  // Parallax
  useEffect(() => {
    const onScroll = () => {
      if (!heroRef.current) return;
      const y = window.scrollY;
      const img = heroRef.current.querySelector('.hero-bg-img');
      if (img) img.style.transform = `scale(1.15) translateY(${y * 0.12}px)`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="home">
      {/* ══ HERO ══ */}
      <section className="hero" ref={heroRef}>
        <div className="hero-bg">
          <img
            className="hero-bg-img"
            src={getImageUrl(heroPhoto, 'full')}
            alt=""
            aria-hidden="true"
            onError={(e) => { e.target.src = getFallbackUrl(heroPhoto); }}
          />
          <div className="hero-vignette" />
        </div>

        {/* Letterbox */}
        <div className="hero-letterbox hero-letterbox--bot" />

        {/* Neon accent line across top */}
        <div className="hero-neon-line" />

        <div className={`hero-content ${heroReady ? 'is-live' : ''}`}>
          <div className="hero-tag-row">
            <span className="hero-dash" />
            <span className="hero-tag mono">PHOTOGRAPHY PORTFOLIO</span>
            <span className="hero-tag-year mono">/ This_Life</span>
          </div>

          <h1 className="hero-h1">
            {HERO_LINES.map((line, li) => {
              const lineStart = allChars.findIndex(c => c.line === li);
              const lineEnd = lineStart + line.text.length;
              const visibleCount = Math.max(0, Math.min(typed - lineStart, line.text.length));
              const visibleText = line.text.slice(0, visibleCount);
              const showCursor = typed >= lineStart && typed < lineEnd;

              const isGlitchTarget = (line.style === 'em' || line.style === 'stroke') && glitch;
              const wordClass = line.style === 'stroke' ? 'hero-word hero-word--stroke' :
                line.style === 'em' ? 'hero-word hero-word--em' : 'hero-word';

              return (
                <span className="hero-line" key={li}>
                  <span
                    className={`${wordClass}${isGlitchTarget ? ' hero-word--glitch' : ''}`}
                    {...(isGlitchTarget || line.style === 'em' || line.style === 'stroke' ? { 'data-text': line.text } : {})}
                  >
                    {[...visibleText].map((ch, ci) => (
                      <span key={ci} className="hero-char-in">{ch}</span>
                    ))}
                    {showCursor && <span className="hero-cursor" />}
                  </span>
                </span>
              );
            })}
          </h1>

          <div className="hero-footer">
            <p className="hero-desc">
              I take photos here and there.
            </p>
            <Link to="/gallery" className="hero-cta">
              <span className="hero-cta-text">Explore Gallery</span>
              <span className="hero-cta-arrow">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <path d="M10 18H26M26 18L20 12M26 18L20 24" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
            </Link>
          </div>
        </div>

        {/* Side elements */}
        <div className="hero-side-scroll">
          <span className="mono">SCROLL</span>
          <span className="hero-scroll-bar" />
        </div>

        <div className="hero-watermark">GOODMORNING<br />TAKAYA</div>
      </section>

      {/* ══ FEATURED ══ */}
      <section className="feat-section">
        <div className="section-head reveal">
          <div className="section-head-left">
            <span className="section-tag mono">SELECTED WORKS</span>
            <h2 className="section-title">Featured</h2>
          </div>
          <span className="section-rule" />
          <span className="section-meta mono">{Math.min(featuredPhotos.length, 3)} PIECES</span>
        </div>
        <EditorialSpread photos={featuredPhotos.slice(0, 3)} onPhotoClick={(p) => setSelectedPhoto(p)} />
      </section>

      {/* ══ CATEGORIES ══ */}
      <section className="cat-section">
        <div className="section-head section-head--center reveal">
          <span className="section-tag mono">EXPLORE</span>
          <h2 className="section-title">Categories</h2>
        </div>

        <div className="view-cursor" ref={catCursorRef}><span>VIEW</span></div>
        <div className="cat-grid" ref={catRef}>
          {photoData.categories.map((cat, i) => {
            const photo = publishedPhotos.find(p => p.id === cat.coverPhoto)
              || publishedPhotos.find(p => p.category === cat.id);
            return (
              <Link
                key={cat.id}
                to={`/gallery?category=${cat.id}`}
                className={`cat-card reveal reveal-d${i + 1}`}
              >
                <div className="cat-img-wrap">
                  {photo && (
                    <img
                      src={getImageUrl(photo, 'display')}
                      alt={cat.name}
                      loading="lazy"
                      onError={(e) => { e.target.src = getFallbackUrl(photo); }}
                    />
                  )}
                </div>
                <div className="cat-overlay">
                  <span className="cat-num mono">0{i + 1}</span>
                  <h3 className="cat-name">{cat.name}</h3>
                  <p className="cat-desc">{cat.description}</p>
                  <span className="cat-line" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="cta-section">
        <div className="cta-inner reveal">
          <span className="cta-tag mono">COLLABORATION</span>
          <h2 className="cta-h2">
            LET'S WORK<br /><span className="cta-stroke">TOGETHER</span>
          </h2>
          <p className="cta-desc">Available for commissions, collaborations, and creative projects.</p>
          <Link to="/about" className="cta-btn">
            <span className="cta-btn-text">GET IN TOUCH</span>
            <span className="cta-btn-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M5 13L13 5M13 5H6M13 5V12" />
              </svg>
            </span>
          </Link>
        </div>
      </section>

      {selectedPhoto && (
        <Lightbox
          photo={selectedPhoto}
          photos={featuredPhotos}
          onClose={() => setSelectedPhoto(null)}
          onNavigate={(p) => setSelectedPhoto(p)}
        />
      )}
    </div>
  );
};

export default Home;
