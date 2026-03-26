"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const navItems = [
  { name: "Dashboard", href: "/admin/dashboard" },
  { name: "Photos", href: "/admin/photos" },
  { name: "Upload", href: "/admin/upload" },
  { name: "Categories", href: "/admin/categories" },
  { name: "Projects", href: "/admin/projects" },
];

export function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="lg:hidden flex items-center justify-between h-[var(--header-h)] shrink-0"
        style={{
          padding: "0 var(--s-page)",
          background: "rgba(11, 11, 11, 0.85)",
          backdropFilter: "blur(16px) saturate(1.2)",
          WebkitBackdropFilter: "blur(16px) saturate(1.2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <Link href="/admin/dashboard" className="flex items-baseline gap-0">
          <span
            className="text-[1.2rem] font-bold text-[var(--white)]"
            style={{ fontFamily: "var(--f-display)" }}
          >
            P
          </span>
          <span
            className="mono text-[0.7rem] text-[var(--ember)]"
          >
            /
          </span>
          <span
            className="mono text-[0.45rem] tracking-[0.15em] uppercase text-[var(--white-ghost)]"
          >
            Admin
          </span>
        </Link>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2 text-[var(--white-ghost)] hover:text-[var(--white)]"
          style={{ transition: `color var(--t-fast) var(--ease-out)` }}
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
        >
          {isOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
          style={{
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 flex flex-col z-50 shrink-0
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          background: "rgba(11, 11, 11, 0.92)",
          backdropFilter: "blur(20px) saturate(1.2)",
          WebkitBackdropFilter: "blur(20px) saturate(1.2)",
          borderRight: "1px solid var(--border)",
          transition: `transform var(--t-base) var(--ease-out)`,
        }}
      >
        {/* Brand */}
        <div
          className="flex items-baseline shrink-0"
          style={{
            height: "var(--header-h)",
            padding: "0 clamp(1.5rem, 3vw, 2rem)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <Link
            href="/admin/dashboard"
            className="flex items-baseline gap-0 group"
          >
            <span
              className="text-[1.8rem] font-bold text-[var(--white)] leading-[var(--header-h)]"
              style={{ fontFamily: "var(--f-display)" }}
            >
              P
            </span>
            <span className="mono text-[1rem] text-[var(--ember)]">/</span>
            <span
              className="mono text-[0.5rem] tracking-[0.15em] uppercase text-[var(--white-ghost)] group-hover:text-[var(--white-dim)]"
              style={{ transition: `color var(--t-fast) var(--ease-out)` }}
            >
              Admin
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto"
          style={{ padding: "clamp(1.5rem, 3vw, 2.5rem) 0" }}
          aria-label="Admin navigation"
        >
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className="group relative flex items-center"
                  style={{
                    padding: "0.75rem clamp(1.5rem, 3vw, 2rem)",
                  }}
                >
                  {/* Active accent bar */}
                  <div
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] bg-[var(--ember)] ${active ? "h-5 opacity-100" : "h-0 opacity-0"}`}
                    style={{
                      boxShadow: active
                        ? "0 0 8px rgba(68, 217, 187, 0.4)"
                        : "none",
                      transition: `height var(--t-base) var(--ease-out), opacity var(--t-fast) var(--ease-out)`,
                    }}
                  />

                  <span
                    className="mono text-[0.7rem] uppercase"
                    style={{
                      letterSpacing: "0.15em",
                      color: active
                        ? "var(--ember)"
                        : "var(--white-ghost)",
                      transition: `color var(--t-fast) var(--ease-out)`,
                    }}
                    onMouseEnter={(e) => {
                      if (!active)
                        e.currentTarget.style.color = "var(--white)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        e.currentTarget.style.color = "var(--white-ghost)";
                    }}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom section */}
        <div
          className="shrink-0"
          style={{
            padding: "clamp(1rem, 2vw, 1.5rem) clamp(1.5rem, 3vw, 2rem)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            onClick={handleLogout}
            className="mono w-full text-left text-[0.6rem] uppercase tracking-[0.2em] text-[var(--white-ghost)] hover:text-[var(--white-dim)]"
            style={{ transition: `color var(--t-fast) var(--ease-out)` }}
          >
            Sign out &rarr;
          </button>
        </div>
      </aside>
    </>
  );
}

/* ── Icons ── */

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="3" y1="6" x2="19" y2="6" />
      <line x1="3" y1="11" x2="19" y2="11" />
      <line x1="3" y1="16" x2="14" y2="16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <line x1="5" y1="5" x2="17" y2="17" />
      <line x1="17" y1="5" x2="5" y2="17" />
    </svg>
  );
}
