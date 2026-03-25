import { useRevealAll } from '../hooks/useReveal';
import { useViewCursor } from '../hooks/useViewCursor';
import ContactForm from '../components/ContactForm/ContactForm';
import './About.css';

const About = () => {
  useRevealAll();
  const { containerRef: contactRef, cursorRef: contactCursorRef } = useViewCursor();

  return (
    <div className="about">
      {/* ══ HERO ══ */}
      <section className="about-hero">
        <div className="about-hero-inner">
          <span className="about-tag mono">ABOUT</span>
          <h1 className="about-h1">
            THE<br /><span className="about-h1-stroke">PHOTO</span><br />GRAPHER
          </h1>
        </div>
        <div className="about-hero-accent" />
      </section>

      {/* ══ BIO ══ */}
      <section className="about-bio">
        <div className="bio-layout">
          <div className="bio-portrait reveal">
            <img src="/photos/japan-bw-4.jpg" alt="Photographer" />
            <div className="bio-portrait-frame" />
          </div>
          <div className="bio-text">
            <h2 className="reveal">
              Hello, I'm <span className="accent">Takaya</span>
            </h2>
            <p className="bio-lead reveal reveal-d1">
              A passionate photographer dedicated to capturing the extraordinary in the ordinary.
            </p>
            <p className="reveal reveal-d2">
              With over a decade of experience behind the lens, I specialize in portraits,
              landscapes, street photography, and architectural photography. My work has been
              featured in various publications and exhibitions worldwide.
            </p>
            <p className="reveal reveal-d2">
              I believe every photograph tells a story. My mission is to find those fleeting
              moments of beauty, emotion, and truth that often go unnoticed, and preserve them
              for eternity.
            </p>
            <div className="bio-stats reveal reveal-d3">
              <div className="stat">
                <span className="stat-num">10+</span>
                <span className="stat-bar" />
                <span className="stat-lbl mono">YEARS EXP.</span>
              </div>
              <div className="stat">
                <span className="stat-num">500+</span>
                <span className="stat-bar" />
                <span className="stat-lbl mono">PROJECTS</span>
              </div>
              <div className="stat">
                <span className="stat-num">50+</span>
                <span className="stat-bar" />
                <span className="stat-lbl mono">AWARDS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CONTACT ══ */}
      <section className="about-contact">
        <div className="contact-inner">
          <span className="contact-tag mono reveal">GET IN TOUCH</span>
          <h2 className="contact-h2 reveal">
            LET'S CREATE<br /><span className="contact-stroke">TOGETHER</span>
          </h2>
          <p className="contact-desc reveal reveal-d1">
            Available for commissions, collaborations, and creative projects.
          </p>

          <div className="view-cursor" ref={contactCursorRef}><span>VIEW</span></div>
          <div className="contact-grid" ref={contactRef}>
            <a href="mailto:hello@portfolio.com" className="contact-card reveal reveal-d1">
              <span className="cc-num mono">01</span>
              <div className="cc-body">
                <span className="cc-label mono">EMAIL</span>
                <span className="cc-value">goodmorning.takaya@gmail.com</span>
              </div>
              <span className="cc-arrow">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M4 10L10 4M10 4H5M10 4V9" />
                </svg>
              </span>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="contact-card reveal reveal-d2">
              <span className="cc-num mono">02</span>
              <div className="cc-body">
                <span className="cc-label mono">INSTAGRAM</span>
                <span className="cc-value">@goodmorning_takaya</span>
              </div>
              <span className="cc-arrow">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M4 10L10 4M10 4H5M10 4V9" />
                </svg>
              </span>
            </a>
          </div>

          {/* ══ FORM ══ */}
          <div className="contact-form-section reveal reveal-d2">
            <div className="contact-form-divider" />
            <span className="contact-form-subtitle mono">OR SEND A MESSAGE DIRECTLY</span>
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
