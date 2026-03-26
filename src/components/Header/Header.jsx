'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Header.css';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/projects', label: 'Projects' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/about', label: 'About' },
];

const Header = () => {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastY, setLastY] = useState(0);
  const [sweep, setSweep] = useState({ entering: null, exiting: null, dir: null });
  const prevPath = useRef(pathname);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 60);
      setHidden(y > 400 && y > lastY);
      setLastY(y);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [lastY]);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      const oldPath = prevPath.current;
      prevPath.current = pathname;
      const oldIdx = NAV_LINKS.findIndex(l => l.to === oldPath);
      const newIdx = NAV_LINKS.findIndex(l => l.to === pathname);

      if (oldIdx !== -1 && newIdx !== -1) {
        const dir = newIdx > oldIdx ? 'right' : 'left';
        setSweep({ entering: pathname, exiting: oldPath, dir });
        const timer = setTimeout(() => setSweep({ entering: null, exiting: null, dir: null }), 425);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname]);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <header className={`hdr ${scrolled ? 'hdr--scrolled' : ''} ${hidden ? 'hdr--hidden' : ''}`}>
        <div className="hdr-inner">
          <Link href="/" className="hdr-logo">
            <span className="hdr-logo-glyph">P</span>
            <span className="hdr-logo-slash">/</span>
            <span className="hdr-logo-sub">FOLIO</span>
          </Link>

          <nav className="hdr-nav">
            {NAV_LINKS.map(({ to, label }) => {
              let sweepClass = '';
              if (sweep.entering === to) sweepClass = `enter-${sweep.dir}`;
              else if (sweep.exiting === to) sweepClass = `exit-${sweep.dir}`;

              return (
                <Link key={to} href={to} className={`hdr-link ${pathname === to ? 'active' : ''} ${sweepClass}`}>
                  <span className="hdr-link-text">{label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            className={`hdr-burger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <span /><span />
          </button>
        </div>
      </header>

      {/* ── Fullscreen overlay ── */}
      <div className={`menu-overlay ${menuOpen ? 'is-open' : ''}`}>
        <div className="menu-backdrop" />
        <nav className="menu-nav">
          {NAV_LINKS.map(({ to, label }, i) => (
            <Link
              key={to}
              href={to}
              className={`menu-link ${pathname === to ? 'active' : ''}`}
              style={{ transitionDelay: menuOpen ? `${0.2 + i * 0.12}s` : '0s' }}
            >
              <span className="menu-label">{label}</span>
              {pathname === to && <span className="menu-active-bar" />}
            </Link>
          ))}
        </nav>
        <div className="menu-bottom" style={{ transitionDelay: menuOpen ? '0.6s' : '0s' }}>
          <span className="menu-bottom-line" />
          <a href="mailto:hello@portfolio.com" className="menu-email">hello@portfolio.com</a>
        </div>
      </div>
    </>
  );
};

export default Header;
