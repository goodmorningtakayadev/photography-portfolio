"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./Header.css";

const NAV_LINKS = [
  { to: "/", label: "Index" },
  { to: "/gallery", label: "Gallery" },
  { to: "/projects", label: "Projects" },
  { to: "/about", label: "Contact" },
];

const WORDMARK = ["GMT"];

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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
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
      {stamp}
      <span className="dim"> · {time} PST</span>
    </span>
  );
}

const Header = () => {
  const pathname = usePathname();
  const navRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, on: false });

  const isActive = (to) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  /* Slide the underline to the active link. Re-measures on route change,
     resize, and once webfonts settle (metrics shift link widths). */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let alive = true;
    const place = () => {
      if (!alive) return;
      const active = nav.querySelector('a[data-on="1"]');
      if (!active) {
        setIndicator((s) => ({ ...s, on: false }));
        return;
      }
      setIndicator({ left: active.offsetLeft, width: active.offsetWidth, on: true });
    };
    place();
    window.addEventListener("resize", place);
    if (document.fonts?.ready) document.fonts.ready.then(place);
    return () => {
      alive = false;
      window.removeEventListener("resize", place);
    };
  }, [pathname]);

  return (
    <header className="chrome">
      <Link href="/" className="wordmark" aria-label="Goodmorning Takaya">
        {WORDMARK.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </Link>

      <div className="chrome-mid">
        <Clock />
        <span className="dim">Open for collabs — Autumn 2026</span>
      </div>

      <nav className="nav" ref={navRef}>
        {NAV_LINKS.map(({ to, label }) => (
          <Link key={to} href={to} data-on={isActive(to) ? "1" : "0"}>
            {label}
          </Link>
        ))}
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span
          className="nav-indicator"
          aria-hidden="true"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: `${indicator.width}px`,
            opacity: indicator.on ? 1 : 0,
          }}
        />
      </nav>
    </header>
  );
};

export default Header;
