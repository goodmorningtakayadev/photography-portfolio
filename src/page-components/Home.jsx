"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import EditorialSpread from "../components/EditorialSpread";
import { useRevealAll } from "../hooks/useReveal";
import { useViewCursor } from "../hooks/useViewCursor";
import { getImageUrl, getFallbackUrl } from "../utils/imageHelpers";
import "./Home.css";

const HEADLINE = ["GOOD", "MORNING", "TAKAYA"];

/* Statement: lead clause in ink, everything after the em-dash in accent. */
const STATEMENT_LEAD = "Just dude that likes taking pictures — ";
const STATEMENT_ACCENT =
  "people, places, accidents and everything in between. Big booty latina clapping machine.";

const TICKER = [
  "GOOD MORNING TAKAYA",
  "PORTRAIT · LANDSCAPE · STREET · ARCHITECTURE · TRAVEL",
  "AVAILABLE FOR COLLABS — AUTUMN 2026",
  "U.S. / SHOOTING EVERYWHERE",
  "2015—2026",
];

/* Infinite marquee — two identical rows scroll -100% for a seamless loop.
   Each row repeats the phrases so it always overflows the viewport (even
   ultra-wide), otherwise a gap would appear before the loop point. */
function Ticker({ items }) {
  const repeated = [...items, ...items, ...items];
  const row = (key) => (
    <div className="ticker__row" key={key} aria-hidden={key === "b"}>
      {repeated.map((s, i) => (
        <span key={i}>{s}</span>
      ))}
    </div>
  );
  return (
    <div className="ticker">
      {row("a")}
      {row("b")}
    </div>
  );
}

const Home = ({ photos, categories, featuredProjects, hero }) => {
  const router = useRouter();
  const heroPhoto = hero?.photo ?? photos[0];
  const heroFocalX = hero?.focalX ?? 50;
  const heroFocalY = hero?.focalY ?? 50;

  useRevealAll();
  const { containerRef: catRef, cursorRef: catCursorRef } = useViewCursor();

  return (
    <div className="home">
      {/* ══ HERO ══ */}
      <section className="hero">
        <div className="hero__aurora" aria-hidden="true" />
        <div className="hero__photo" aria-hidden="true">
          {heroPhoto && (
            <img
              src={getImageUrl(heroPhoto, "full")}
              alt=""
              style={{ objectPosition: `${heroFocalX}% ${heroFocalY}%` }}
              onError={(e) => {
                e.target.src = getFallbackUrl(heroPhoto);
              }}
            />
          )}
        </div>
        <div className="hero__glass" aria-hidden="true" />
        <div className="hero__vignette" aria-hidden="true" />

        <div className="hero__inner">
          <h1 className="hero__headline display">
            {HEADLINE.map((line, i) => (
              <div key={i}>
                {i === HEADLINE.length - 1 ? (
                  <span className="accent-text">{line}</span>
                ) : (
                  line
                )}
              </div>
            ))}
          </h1>
          <div className="hero__foot">
            <p className="hero__statement">
              {STATEMENT_LEAD}
              <span className="accent-text">{STATEMENT_ACCENT}</span>
            </p>
          </div>
        </div>

        <div className="hero__scroll">
          <i />
          Scroll
        </div>
      </section>

      {/* ══ TICKER ══ */}
      <Ticker items={TICKER} />

      {/* ══ FEATURED PROJECTS ══ */}
      <section className="feat-section">
        <div className="section-head reveal">
          <div className="section-head-left">
            <span className="section-tag mono">SELECTED WORKS</span>
            <h2 className="section-title">Featured</h2>
          </div>
          <span className="section-rule" />
          <span className="section-meta mono">
            {featuredProjects.length}{" "}
            {featuredProjects.length === 1 ? "PROJECT" : "PROJECTS"}
          </span>
        </div>
        {featuredProjects.length > 0 ? (
          <EditorialSpread
            photos={featuredProjects.map((p) => ({
              ...(p.coverPhoto || {}),
              id: p.id,
              title: p.title,
              category: "",
              categoryName: "Project",
              _slug: p.slug,
            }))}
            onPhotoClick={(photo) => router.push(`/projects/${photo._slug}`)}
          />
        ) : (
          <div className="feat-empty reveal">
            <p className="feat-empty-text mono">No projects published yet.</p>
          </div>
        )}
      </section>

      {/* ══ CATEGORIES ══ */}
      <section className="cat-section">
        <div className="section-head section-head--center reveal">
          <span className="section-tag mono">EXPLORE</span>
          <h2 className="section-title">Categories</h2>
        </div>

        <div className="view-cursor" ref={catCursorRef}>
          <span>VIEW</span>
        </div>
        <div className="cat-grid" ref={catRef}>
          {categories.map((cat, i) => {
            const photo = cat.coverPhoto;
            return (
              <Link
                key={cat.id}
                href={`/gallery?category=${cat.id}`}
                className={`cat-card reveal reveal-d${i + 1}`}
              >
                <div className="cat-img-wrap">
                  {photo && (
                    <img
                      src={getImageUrl(photo, "display")}
                      alt={cat.name}
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = getFallbackUrl(photo);
                      }}
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
            LET'S WORK
            <br />
            <span className="cta-stroke">TOGETHER</span>
          </h2>
          <p className="cta-desc">
            Available for commissions, collaborations, and creative projects.
          </p>
          <Link href="/about" className="cta-btn">
            <span className="cta-btn-text">GET IN TOUCH</span>
            <span className="cta-btn-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <path d="M5 13L13 5M13 5H6M13 5V12" />
              </svg>
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
