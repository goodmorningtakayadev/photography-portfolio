"use client";

import { useState, useEffect, useRef } from "react";
import type { Category } from "@/db/schema";
import type { PhotoWithThumb } from "@/db/queries/admin";

export function PhotoEditModal({
  photo,
  categories,
  onClose,
  onSaved,
}: {
  photo: PhotoWithThumb;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [altText, setAltText] = useState(photo.altText ?? "");
  const [sortOrder, setSortOrder] = useState(String(photo.gallerySortOrder));
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load current categories via API
  useEffect(() => {
    let cancelled = false;
    async function loadPhotoCategories() {
      try {
        const res = await fetch(`/api/photos/${photo.id}`);
        if (res.ok && !cancelled) {
          const { data } = await res.json();
          if (data?.categories) {
            setSelectedCategoryIds(
              data.categories.map((c: { id: string }) => c.id),
            );
          }
        }
      } catch {
        // Non-critical
      }
    }
    loadPhotoCategories();
    return () => {
      cancelled = true;
    };
  }, [photo.id]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: caption || null,
          altText: altText || null,
          gallerySortOrder: parseInt(sortOrder, 10) || 0,
          categoryIds: selectedCategoryIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      onSaved();
    } catch {
      setError("Unable to connect. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id],
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
        style={{ animation: "fadeInUp 0.3s var(--ease-out) both" }}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-photo-title"
        tabIndex={-1}
        className="relative bg-[var(--black-elevated)] border border-[var(--border-strong)] rounded-sm w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden outline-none"
        style={{ animation: "fadeInUp 0.4s var(--ease-out) both" }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] shrink-0" style={{ padding: "0.75rem 2rem" }}>
            <h2
              id="edit-photo-title"
              className="text-sm font-bold uppercase tracking-[0.2em]"
              style={{ fontFamily: "var(--f-display)" }}
            >
              Edit Photo
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--white-ghost)] hover:text-[var(--white)] p-1"
              style={{ transition: `color var(--t-fast) var(--ease-out)` }}
              aria-label="Close"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 22 22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <line x1="5" y1="5" x2="17" y2="17" />
                <line x1="17" y1="5" x2="5" y2="17" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto" style={{ padding: "1.25rem 2rem" }}>
            {/* Caption */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                htmlFor="edit-caption"
                className="mono block text-[0.6rem] text-[var(--white-ghost)] uppercase tracking-[0.2em]"
                style={{ marginBottom: "0.75rem" }}
              >
                Caption
              </label>
              <input
                id="edit-caption"
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={500}
                className="w-full bg-[var(--black-surface)] border border-[var(--border)] rounded-sm py-2 text-sm text-[var(--white)] placeholder:text-[var(--white-ghost)] focus:outline-none focus:border-[var(--ember)]"
                style={{ paddingLeft: "0.5rem", paddingRight: "0.5rem", transition: `border-color var(--t-fast) var(--ease-out)` }}
                placeholder="Photo caption"
              />
            </div>

            {/* Alt text */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                htmlFor="edit-alttext"
                className="mono block text-[0.6rem] text-[var(--white-ghost)] uppercase tracking-[0.2em]"
                style={{ marginBottom: "0.75rem" }}
              >
                Alt Text
              </label>
              <textarea
                id="edit-alttext"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full bg-[var(--black-surface)] border border-[var(--border)] rounded-sm py-2 text-sm text-[var(--white)] placeholder:text-[var(--white-ghost)] focus:outline-none focus:border-[var(--ember)] resize-none"
                style={{ paddingLeft: "0.5rem", paddingRight: "0.5rem", transition: `border-color var(--t-fast) var(--ease-out)` }}
                placeholder="Describe this image for accessibility"
              />
            </div>

            {/* Sort order */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                htmlFor="edit-sort"
                className="mono block text-[0.6rem] text-[var(--white-ghost)] uppercase tracking-[0.2em]"
                style={{ marginBottom: "0.75rem" }}
              >
                Gallery Sort Order
              </label>
              <input
                id="edit-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full bg-[var(--black-surface)] border border-[var(--border)] rounded-sm py-2 text-sm text-[var(--white)] focus:outline-none focus:border-[var(--ember)]"
                style={{ paddingLeft: "0.5rem", paddingRight: "0.5rem", transition: `border-color var(--t-fast) var(--ease-out)` }}
              />
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <p
                  className="mono text-[0.6rem] text-[var(--white-ghost)] uppercase tracking-[0.2em]"
                  style={{ marginBottom: "0.75rem" }}
                >
                  Categories
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const selected = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`mono px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] rounded-sm border ${
                          selected
                            ? "bg-[var(--ember-glow)] border-[var(--ember)] text-[var(--ember)]"
                            : "border-[var(--border)] text-[var(--white-ghost)] hover:text-[var(--white-dim)] hover:border-[var(--border-strong)]"
                        }`}
                        style={{ transition: `all var(--t-fast) var(--ease-out)` }}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="mt-4 flex items-center gap-3 px-4 py-2.5 rounded-sm bg-red-500/10 border border-red-500/20"
                style={{ animation: "fadeInUp 0.3s var(--ease-out) both" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-red-400 shrink-0"
                >
                  <circle cx="7" cy="7" r="6" />
                  <line x1="7" y1="4.5" x2="7" y2="7.5" />
                  <circle cx="7" cy="9.5" r="0.5" fill="currentColor" />
                </svg>
                <span className="text-xs text-red-400" style={{ fontFamily: "var(--f-body)" }}>
                  {error}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] shrink-0" style={{ padding: "0.75rem 2rem" }}>
            <button
              type="button"
              onClick={onClose}
              className="mono px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-[var(--white-ghost)] hover:text-[var(--white)]"
              style={{ transition: `color var(--t-fast) var(--ease-out)` }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="mono px-4 py-2 text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm bg-[var(--ember)] text-[var(--white)] hover:bg-[var(--ember-hot)] disabled:opacity-50"
              style={{ transition: `all var(--t-fast) var(--ease-out)` }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
