"use client";

import Link from "next/link";
import SelectedWorks from "../components/SelectedWorks/SelectedWorks";
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

/* Infinite marquee — items duplicated so the -50% loop is seamless. */
function Ticker({ items }) {
  const row = (key) => (
    <div className="ticker__row" key={key} aria-hidden={key === "b"}>
      {items.map((s, i) => (
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

      {/* ══ SELECTED WORKS ══ */}
      <SelectedWorks projects={featuredProjects} />

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
            HIT ME UP
            <br />
          </h2>
          <p className="cta-desc">
            Available for collaboration and creative projects.
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
