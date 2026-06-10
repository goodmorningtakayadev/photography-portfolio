"use client";

import Link from "next/link";
import "./Footer.css";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="ft">
      <div className="ft-inner">
        <div className="ft-top">
          <div className="ft-brand">
            <Link href="/" className="ft-logo">
              <span className="ft-logo-glyph">P</span>
              <span className="ft-logo-slash">/</span>
              <span className="ft-logo-sub">FOLIO</span>
            </Link>
          </div>

          <nav className="ft-col">
            <span className="ft-heading mono">NAVIGATE</span>
            <Link href="/">Home</Link>
            <Link href="/gallery">Gallery</Link>
            <Link href="/about">About</Link>
          </nav>

          <div className="ft-col">
            <span className="ft-heading mono">CONNECT</span>
            <a
              href="https://www.instagram.com/goodmorning_takaya/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>

            <a href="mailto:goodmorning.takaya@gmail.com">Email</a>
          </div>
        </div>

        <div className="ft-bottom">
          <p className="mono">&copy; {year} ALL RIGHTS RESERVED</p>
          <p className="ft-made mono">SMILE DUDE</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
