"use client";

import { useState, useRef } from "react";
import type { CategoryWithCount } from "@/db/queries/admin";
import { slugify, CATEGORY_SLUG_MAX } from "@/lib/slug";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/admin-api";

// --- Types ---

type CategoryItem = CategoryWithCount;

// --- Component ---

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: CategoryItem[];
}) {
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // --- Error display ---

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  }

  // --- Add category ---

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setIsAdding(true);
    setError(null);

    try {
      const result = await createCategory(trimmed);

      if (!result.ok) {
        showError(result.error);
        return;
      }

      // Add to local state with photoCount = 0
      setCategories((prev) => [...prev, { ...result.data, photoCount: 0 }]);
      setNewName("");
      addInputRef.current?.focus();
    } finally {
      setIsAdding(false);
    }
  }

  // --- Edit category ---

  function startEdit(cat: CategoryItem) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setTimeout(() => editInputRef.current?.select(), 0);
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    const original = categories.find((c) => c.id === id);
    if (original?.name === trimmed) {
      setEditingId(null);
      return;
    }

    try {
      const result = await updateCategory(id, { name: trimmed });

      if (!result.ok) {
        showError(result.error);
        return;
      }

      const { name, slug } = result.data;
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name, slug } : c)),
      );
    } finally {
      setEditingId(null);
    }
  }

  // --- Delete category ---

  async function handleDelete(id: string) {
    try {
      const result = await deleteCategory(id);

      if (!result.ok) {
        showError(result.error);
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeleteConfirmId(null);
    }
  }

  // --- Reorder ---

  async function moveCategory(id: string, direction: "up" | "down") {
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= categories.length) return;

    const current = categories[index];
    const swap = categories[swapIndex];

    // Optimistic update
    const newCategories = [...categories];
    newCategories[index] = { ...swap, sortOrder: current.sortOrder };
    newCategories[swapIndex] = { ...current, sortOrder: swap.sortOrder };
    setCategories(newCategories);

    // PATCH both categories
    const [res1, res2] = await Promise.all([
      updateCategory(current.id, { sortOrder: swap.sortOrder }),
      updateCategory(swap.id, { sortOrder: current.sortOrder }),
    ]);

    if (!res1.ok || !res2.ok) {
      // Revert on failure
      setCategories(categories);
      showError("Failed to reorder. Reverted.");
    }
  }

  // --- Render ---

  const addSlug = slugify(newName, CATEGORY_SLUG_MAX) ?? "";

  return (
    <div className="max-w-2xl">
      {/* Error banner */}
      {error && (
        <div
          className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-sm bg-red-500/10 border border-red-500/20"
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

      {/* Add category */}
      <div
        className="mb-8 rounded-sm"
        style={{
          background: "rgba(17, 17, 16, 0.5)",
          border: "1px solid var(--border)",
          padding: "1rem",
          paddingLeft: "calc(1rem + 12px + 0.75rem)",
          animation: "fadeInUp 0.5s var(--ease-out) both",
        }}
      >
        <label
          className="mono block text-[0.6rem] uppercase tracking-[0.2em] text-[var(--white-ghost)]"
          style={{ marginBottom: "1.5rem" }}
          htmlFor="new-category-name"
        >
          Add Category
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              ref={addInputRef}
              id="new-category-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) handleAdd();
              }}
              placeholder="Category name"
              maxLength={100}
              className="w-full bg-transparent border-b border-[var(--border-strong)] text-sm text-[var(--white)] placeholder:text-[var(--white-ghost)] pb-2 outline-none focus:border-[var(--ember)]"
              style={{
                fontFamily: "var(--f-body)",
                transition: `border-color var(--t-fast) var(--ease-out)`,
              }}
            />
            {newName.trim() && addSlug && (
              <p className="mono mt-1.5 text-[0.5rem] text-[var(--white-ghost)] tracking-[0.1em]">
                /{addSlug}
              </p>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || isAdding}
            className="mono self-start text-[0.65rem] uppercase tracking-[0.2em] py-3 rounded-sm disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            style={{
              background: "var(--ember)",
              color: "var(--black)",
              fontWeight: 600,
              transition: `opacity var(--t-fast) var(--ease-out)`,
              paddingLeft: "1.5rem",
              paddingRight: "1.2rem",
            }}
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {/* Category list */}
      {categories.length === 0 ? (
        <div
          className="border border-[var(--border)] rounded-sm py-16 text-center"
          style={{ animation: "fadeInUp 0.6s var(--ease-out) 0.2s both" }}
        >
          <p
            className="text-[var(--white-ghost)] text-sm"
            style={{ fontFamily: "var(--f-body)" }}
          >
            No categories yet. Add one above.
          </p>
        </div>
      ) : (
        <div
          className="border border-[var(--border)] rounded-sm overflow-hidden"
          style={{ animation: "fadeInUp 0.5s var(--ease-out) 0.1s both" }}
        >
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 group"
              style={{
                padding: "0.875rem 1rem",
                borderBottom:
                  index < categories.length - 1
                    ? "1px solid var(--border)"
                    : "none",
                background:
                  deleteConfirmId === cat.id
                    ? "rgba(239, 68, 68, 0.05)"
                    : "transparent",
                transition: `background var(--t-fast) var(--ease-out)`,
                animation: `fadeInUp 0.4s var(--ease-out) ${0.15 + index * 0.05}s both`,
              }}
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => moveCategory(cat.id, "up")}
                  disabled={index === 0}
                  className="text-[var(--white-ghost)] hover:text-[var(--ember)] disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
                  style={{
                    transition: `color var(--t-fast) var(--ease-out)`,
                  }}
                  title="Move up"
                  aria-label={`Move ${cat.name} up`}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="2 8 6 4 10 8" />
                  </svg>
                </button>
                <button
                  onClick={() => moveCategory(cat.id, "down")}
                  disabled={index === categories.length - 1}
                  className="text-[var(--white-ghost)] hover:text-[var(--ember)] disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
                  style={{
                    transition: `color var(--t-fast) var(--ease-out)`,
                  }}
                  title="Move down"
                  aria-label={`Move ${cat.name} down`}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="2 4 6 8 10 4" />
                  </svg>
                </button>
              </div>

              {/* Name / Edit */}
              <div className="flex-1 min-w-0">
                {editingId === cat.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(cat.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => saveEdit(cat.id)}
                    maxLength={100}
                    className="w-full bg-transparent border-b border-[var(--ember)] text-sm text-[var(--white)] pb-0.5 outline-none"
                    style={{ fontFamily: "var(--f-body)" }}
                    autoFocus
                  />
                ) : (
                  <div>
                    <p
                      className="text-sm text-[var(--white)]"
                      style={{ fontFamily: "var(--f-body)" }}
                    >
                      {cat.name}
                    </p>
                    <p className="mono text-[0.5rem] text-[var(--white-ghost)] tracking-[0.1em] mt-0.5">
                      /{cat.slug}
                    </p>
                  </div>
                )}
              </div>

              {/* Photo count */}
              <span className="mono text-[0.55rem] text-[var(--ember)] tracking-[0.1em] shrink-0">
                {cat.photoCount} photo{cat.photoCount !== 1 ? "s" : ""}
              </span>

              {/* Actions */}
              {deleteConfirmId === cat.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="mono text-[0.55rem] uppercase tracking-[0.15em] text-red-400 hover:text-red-300 px-2 py-1"
                    style={{
                      transition: `color var(--t-fast) var(--ease-out)`,
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="mono text-[0.55rem] uppercase tracking-[0.15em] text-[var(--white-ghost)] hover:text-[var(--white-dim)] px-2 py-1"
                    style={{
                      transition: `color var(--t-fast) var(--ease-out)`,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100"
                  style={{ transition: `opacity var(--t-fast) var(--ease-out)` }}
                >
                  <button
                    onClick={() => startEdit(cat)}
                    className="mono text-[0.55rem] uppercase tracking-[0.15em] text-[var(--white-ghost)] hover:text-[var(--ember)] px-2 py-1"
                    style={{
                      transition: `color var(--t-fast) var(--ease-out)`,
                    }}
                    title="Edit category"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(cat.id)}
                    className="mono text-[0.55rem] uppercase tracking-[0.15em] text-[var(--white-ghost)] hover:text-red-400 px-2 py-1"
                    style={{
                      transition: `color var(--t-fast) var(--ease-out)`,
                    }}
                    title="Delete category"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer info */}
      {categories.length > 0 && (
        <p
          className="mono mt-12 text-[0.5rem] uppercase tracking-[0.2em] text-right"
          style={{ animation: `fadeInUp 0.4s var(--ease-out) ${0.2 + categories.length * 0.05}s both` }}
        >
          <span className="text-[var(--ember)]">{categories.length} categor{categories.length === 1 ? "y" : "ies"}</span>
          <span className="text-[var(--white-ghost)]"> &middot; Use arrows to reorder</span>
        </p>
      )}
    </div>
  );
}
