"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      const { data, error: apiError } = await res.json();

      if (!res.ok) {
        setError(apiError || "Failed to create project");
        return;
      }

      router.push(`/admin/projects/${data.id}`);
    } catch {
      setError("Unable to connect. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="max-w-[var(--max-w)] mx-auto"
      style={{
        padding: "clamp(2rem, 4vw, 3.5rem) clamp(1.5rem, 5vw, 5rem)",
        paddingLeft: "clamp(2.5rem, 6vw, 6rem)",
      }}
    >
      <a
        href="/admin/projects"
        className="mono inline-block text-[10px] uppercase tracking-[0.15em] text-[var(--white-ghost)] hover:text-[var(--white)]"
        style={{ transition: `color var(--t-fast) var(--ease-out)`, marginBottom: "1.5rem", animation: "fadeInUp 0.5s var(--ease-out) both" }}
      >
        &larr; Back to Projects
      </a>

      <h1
        className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold uppercase tracking-tight leading-none text-[var(--white)]"
        style={{ fontFamily: "var(--f-display)", letterSpacing: "-0.02em", marginBottom: "3rem", animation: "fadeInUp 0.5s var(--ease-out) 0.05s both" }}
      >
        New Project
      </h1>

      <form onSubmit={handleSubmit} className="max-w-md" style={{ animation: "fadeInUp 0.5s var(--ease-out) 0.15s both" }}>
        <div style={{ marginBottom: "3rem" }}>
          <label
            htmlFor="project-title"
            className="mono block text-[0.6rem] text-[var(--white-ghost)] uppercase tracking-[0.2em]"
            style={{ marginBottom: "1.5rem" }}
          >
            Project Title
          </label>
          <input
            id="project-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
            className="w-full bg-[var(--black-surface)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--white)] placeholder:text-[var(--white-ghost)] focus:outline-none focus:border-[var(--ember)]"
            style={{ transition: `border-color var(--t-fast) var(--ease-out)` }}
            placeholder="e.g. LA Session"
          />
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="mono text-[0.65rem] uppercase tracking-[0.2em] rounded-sm disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "var(--ember)",
              color: "var(--black)",
              fontWeight: 600,
              transition: `opacity var(--t-fast) var(--ease-out)`,
              paddingLeft: "1.5rem",
              paddingRight: "1.2rem",
              paddingTop: "0.75rem",
              paddingBottom: "0.75rem",
            }}
          >
            {loading ? "Creating..." : "Create Project"}
          </button>
          <a
            href="/admin/projects"
            className="mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--white-ghost)] hover:text-[var(--white)]"
            style={{
              transition: `color var(--t-fast) var(--ease-out)`,
              paddingLeft: "1.5rem",
              paddingRight: "1.2rem",
              paddingTop: "0.75rem",
              paddingBottom: "0.75rem",
            }}
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
