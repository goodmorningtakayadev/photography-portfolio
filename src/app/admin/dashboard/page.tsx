import Link from "next/link";
import { getPhotoStats, getRecentPhotos } from "@/db/queries/admin";
import { cdnUrlFor } from "@/lib/image-url";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const [stats, recentPhotos] = await Promise.all([
    getPhotoStats(),
    getRecentPhotos(8),
  ]);

  const statItems = [
    { label: "Total", value: stats.total, accent: false },
    { label: "Published in Gallery", value: stats.published, accent: true },
    { label: "Processing", value: stats.processing, accent: false },
    { label: "Failed", value: stats.failed, accent: false },
    { label: "Archived", value: stats.archived, accent: false },
  ];

  return (
    <div
      className="max-w-[var(--max-w)] mx-auto"
      style={{
        padding: "clamp(2rem, 4vw, 3.5rem) clamp(1.5rem, 5vw, 5rem)",
        paddingLeft: "clamp(2.5rem, 6vw, 6rem)",
      }}
    >
      {/* Page heading */}
      <h1
        className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold uppercase tracking-tight leading-none text-[var(--white)]"
        style={{ fontFamily: "var(--f-display)", letterSpacing: "-0.02em", marginBottom: "3rem", animation: "fadeInUp 0.5s var(--ease-out) both" }}
      >
        Dashboard
      </h1>

      {/* Stats row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem 0", marginBottom: "3rem" }}>
        {statItems.map((stat, i) => (
          <div
            key={stat.label}
            style={{
              flex: "1 1 0%",
              paddingTop: "1rem",
              paddingBottom: "1rem",
              textAlign: "center",
              borderRight: i < statItems.length - 1 ? "1px solid var(--border)" : "none",
              animation: `fadeInUp 0.6s var(--ease-out) ${0.1 + i * 0.08}s both`,
            }}
          >
            <p
              className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-none tabular-nums"
              style={{
                fontFamily: "var(--f-display)",
                color: stat.accent
                  ? "var(--ember)"
                  : stat.value === 0
                    ? "var(--white-ghost)"
                    : "var(--white)",
                letterSpacing: "-0.02em",
              }}
            >
              {stat.value}
            </p>
            <p
              className="mono mt-2 text-[0.6rem] uppercase tracking-[0.2em]"
              style={{
                color: stat.accent ? "var(--ember)" : "var(--white-ghost)",
              }}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-[var(--border)] mb-0" />

      {/* Recent uploads section */}
      <div>
        <div className="flex items-center justify-between mb-12">
          <h2
            className="mono text-[0.6rem] uppercase tracking-[0.25em] text-[var(--white-ghost)]"
          >
            Recent Uploads
          </h2>
          <Link
            href="/admin/photos"
            className="mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--ember)] hover:text-[var(--ember-hot)] group flex items-center gap-2"
            style={{ transition: `color var(--t-fast) var(--ease-out)` }}
          >
            View all
            <span
              className="inline-block group-hover:translate-x-1"
              style={{ transition: `transform var(--t-fast) var(--ease-out)` }}
            >
              &rarr;
            </span>
          </Link>
        </div>

        {recentPhotos.length === 0 ? (
          <div
            className="border border-[var(--border)] rounded-sm py-20 text-center"
            style={{
              animation: "fadeInUp 0.6s var(--ease-out) 0.3s both",
            }}
          >
            <p
              className="text-[var(--white-ghost)] text-sm mb-4"
              style={{ fontFamily: "var(--f-body)" }}
            >
              No photos uploaded yet
            </p>
            <Link
              href="/admin/upload"
              className="mono inline-flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.2em] text-[var(--ember)] hover:text-[var(--ember-hot)]"
              style={{ transition: `color var(--t-fast) var(--ease-out)` }}
            >
              <span
                className="flex items-center justify-center w-10 h-10 rounded-full border border-[var(--ember)]"
                style={{
                  boxShadow:
                    "0 0 12px rgba(126, 20, 32, 0.1), inset 0 0 12px rgba(126, 20, 32, 0.05)",
                }}
              >
                &uarr;
              </span>
              Upload first photo
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {recentPhotos.map((photo, i) => (
              <Link
                key={photo.id}
                href="/admin/photos"
                className="group relative aspect-[4/5] overflow-hidden border border-transparent hover:border-[var(--ember)] rounded-sm"
                style={{
                  animation: `fadeInUp 0.6s var(--ease-out) ${0.2 + i * 0.06}s both`,
                  transition: `border-color var(--t-base) var(--ease-out)`,
                }}
              >
                {photo.thumbStorageKey ? (
                  <img
                    src={cdnUrlFor(photo.thumbStorageKey)}
                    alt={photo.altText || photo.caption || "Photo"}
                    className="w-full h-full object-cover group-hover:scale-[1.06]"
                    loading="lazy"
                    style={{
                      filter:
                        "saturate(0.6) contrast(1.1) brightness(0.85)",
                      transition: `transform var(--t-base) var(--ease-out), filter var(--t-base) var(--ease-out)`,
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[var(--black-warm)]">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 28 28"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-[var(--white-ghost)] opacity-25"
                    >
                      <rect x="2" y="4" width="24" height="20" rx="2" />
                      <circle cx="9" cy="12" r="2.5" />
                      <path d="M2 20l6-6 3 3 5-6 10 9" />
                    </svg>
                  </div>
                )}

                {/* Ember top bar on hover */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--ember)] origin-left scale-x-0 group-hover:scale-x-100"
                  style={{
                    transition: `transform var(--t-base) var(--ease-out)`,
                    boxShadow: "0 0 8px rgba(126, 20, 32, 0.4)",
                  }}
                />

                {/* Bottom info overlay */}
                <div
                  className="absolute inset-x-0 bottom-0 p-3 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(11,11,11,0.9) 0%, transparent 100%)",
                    transition: `opacity var(--t-base) var(--ease-out), transform var(--t-base) var(--ease-out)`,
                  }}
                >
                  <p
                    className="text-xs text-[var(--white-dim)] truncate mb-1"
                    style={{ fontFamily: "var(--f-body)" }}
                  >
                    {photo.caption || "Untitled"}
                  </p>
                  <StatusBadge status={photo.status} />
                </div>

                {/* Status badge (always visible for non-ready) */}
                {photo.status !== "ready" && (
                  <div className="absolute top-2 left-2 group-hover:opacity-0"
                    style={{ transition: `opacity var(--t-fast) var(--ease-out)` }}
                  >
                    <StatusBadge status={photo.status} />
                  </div>
                )}

                {/* Published indicator */}
                {photo.isPublished && photo.status === "ready" && (
                  <div
                    className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-[var(--ember)]"
                    style={{
                      boxShadow: "0 0 6px rgba(126, 20, 32, 0.5)",
                    }}
                    title="Published"
                  />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
