"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectWithMeta } from "@/db/queries/admin";
import { cdnUrlFor } from "@/lib/image-url";

export function ProjectList({ projects }: { projects: ProjectWithMeta[] }) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleTogglePublish = async (project: ProjectWithMeta) => {
    setActionLoading(project.id);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !project.isPublished }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Action failed");
      }
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (project: ProjectWithMeta) => {
    if (
      !confirm(
        `Delete "${project.title}"? This removes the project but keeps all photos.`,
      )
    ) {
      return;
    }

    // Start fade-out animation
    setDeletingId(project.id);

    // Wait for animation to finish, then delete
    await new Promise((r) => setTimeout(r, 350));

    setActionLoading(project.id);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Delete failed");
        setDeletingId(null);
      }
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  if (projects.length === 0) {
    return (
      <div
        className="p-12 text-center"
        style={{ animation: "fadeInUp 0.5s var(--ease-out) both" }}
      >
        <p className="text-[var(--white-ghost)] text-sm">
          No projects yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {projects.map((project, index) => {
        const isLoading = actionLoading === project.id;
        const isDeleting = deletingId === project.id;
        return (
          <div
            key={project.id}
            className={`group relative flex flex-col bg-[var(--black-surface)] border border-[var(--border)] rounded-sm overflow-hidden ${
              isLoading ? "opacity-50 pointer-events-none" : ""
            }`}
            style={{
              animation: `fadeInUp 0.4s var(--ease-out) ${index * 0.06}s both`,
              ...(isDeleting
                ? {
                    opacity: 0,
                    transform: "scale(0.95) translateY(8px)",
                    transition: "opacity 0.35s var(--ease-out), transform 0.35s var(--ease-out)",
                    pointerEvents: "none",
                  }
                : {}),
            }}
          >
            {/* Cover photo */}
            <div className="aspect-video relative">
              {project.coverThumbStorageKey ? (
                <img
                  src={cdnUrlFor(project.coverThumbStorageKey)}
                  alt={`Cover for ${project.title}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--black-warm)] text-[var(--white-ghost)]">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="opacity-20"
                  >
                    <rect x="2" y="3" width="20" height="18" rx="3" />
                    <circle cx="8" cy="10" r="2" />
                    <path d="M2 17l5-5 3 3 4-5 8 7" />
                  </svg>
                </div>
              )}

              {/* Published indicator */}
              {project.isPublished && (
                <div
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--ember)]"
                  title="Published"
                />
              )}
            </div>

            {/* Info - anchored to bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 py-5"
              style={{
                paddingLeft: "0.5rem",
                paddingRight: "0.5rem",
                background: "rgba(11, 11, 11, 0.75)",
                backdropFilter: "blur(12px) saturate(1.2)",
                WebkitBackdropFilter: "blur(12px) saturate(1.2)",
              }}
            >
              <p className="text-[10px] text-[var(--white-dim)] truncate font-medium">
                {project.title}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="mono text-[10px] text-[var(--ember)] tabular-nums">
                  {project.photoCount}{" "}
                  {project.photoCount === 1 ? "photo" : "photos"}
                </span>
                {project.isPublished && (
                  <span className="mono text-[10px] text-[var(--ember)]">
                    Published
                  </span>
                )}
              </div>
            </div>

            {/* Action overlay - spans entire card */}
            <div
              className="absolute inset-0 bg-[var(--black)]/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto flex flex-col items-center justify-center gap-1.5 p-3"
              style={{
                transition: `opacity var(--t-fast) var(--ease-out)`,
              }}
            >
              <a
                href={`/admin/projects/${project.id}`}
                className="mono w-full px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-[0.1em] rounded-sm text-[var(--white)]"
                style={{
                  transition: `background var(--t-fast) var(--ease-out)`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Edit
              </a>
              <button
                onClick={() => handleTogglePublish(project)}
                className={`mono w-full px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] rounded-sm ${project.isPublished ? "text-yellow-400" : "text-green-400"}`}
                style={{
                  transition: `background var(--t-fast) var(--ease-out)`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = project.isPublished ? "rgba(250,204,21,0.1)" : "rgba(74,222,128,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {project.isPublished ? "Unpublish" : "Publish"}
              </button>
              <button
                onClick={() => handleDelete(project)}
                className="mono w-full px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] rounded-sm text-red-400"
                style={{
                  transition: `background var(--t-fast) var(--ease-out)`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
