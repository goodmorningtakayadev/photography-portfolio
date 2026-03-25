import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="ft">
      <div className="ft-inner">
        <div className="ft-top">
          <div className="ft-brand">
            <Link to="/" className="ft-logo">
              <span className="ft-logo-glyph">P</span>
              <span className="ft-logo-slash">/</span>
              <span className="ft-logo-sub">FOLIO</span>
            </Link>
          </div>

          <nav className="ft-col">
            <span className="ft-heading mono">NAVIGATE</span>
            <Link to="/">Home</Link>
            <Link to="/gallery">Gallery</Link>
            <Link to="/about">About</Link>
          </nav>

          <div className="ft-col">
            <span className="ft-heading mono">CONNECT</span>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href="mailto:hello@portfolio.com">Email</a>
          </div>
        </div>

        <div className="ft-bottom">
          <p className="mono">&copy; {year} ALL RIGHTS RESERVED</p>
          <p className="ft-made mono">MADE WITH OBSESSION</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
