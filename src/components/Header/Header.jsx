'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Header.css';

const NAV_LINKS = [
  { to: '/', label: 'Index' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'Contact' },
];

const WORDMARK = ['GOOD', 'MORNING', 'TAKAYA'];

/* Live clock — client-only; renders empty on the server and first client
   paint (now === null) so there is no hydration mismatch. */
function Clock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span className="chrome-clock" />;
  // Render the wall-clock time in Pacific time, regardless of visitor locale.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(now)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  const stamp = `${parts.year}.${parts.month}.${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  return (
    <span className="chrome-clock">
      {stamp}<span className="dim"> · {time} PST</span>
    </span>
  );
}

const Header = () => {
  const pathname = usePathname();
  const isActive = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <header className="chrome">
      <Link href="/" className="wordmark" aria-label="Goodmorning Takaya">
        {WORDMARK.map((l, i) => <div key={i}>{l}</div>)}
      </Link>

      <div className="chrome-mid">
        <Clock />
        <span className="dim">Open for collabs — Autumn 2026</span>
      </div>

      <nav className="nav">
        {NAV_LINKS.map(({ to, label }) => (
          <Link key={to} href={to} data-on={isActive(to) ? '1' : '0'}>
            {label}
          </Link>
        ))}
        <span className="dots" aria-hidden="true"><i /><i /><i /></span>
      </nav>
    </header>
  );
};

export default Header;
