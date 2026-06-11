"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/db/schema";
import type { ProjectDetail, PhotoWithThumb } from "@/db/queries/admin";
import { cdnUrlFor } from "@/lib/image-url";

export function ProjectEditor({
  project,
  availablePhotos,
  categories,
}: {
  project: ProjectDetail;
  availablePhotos: PhotoWithThumb[];
  categories: Category[];
}) {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState(project.title);
  const [slug, setSlug] = useState(project.slug);
  const [description, setDescription] = useState(project.description ?? "");
  const [isPublished, setIsPublished] = useState(project.isPublished);
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(
    project.coverPhotoId,
  );
  const [projectPhotos, setProjectPhotos] = useState(project.photos);

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  // Scene note editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // ── Save project details ──

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          isPublished,
        }),
      });

      const { error } = await res.json();
      if (!res.ok) {
        setSaveError(error || "Failed to save");
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      setSaveError("Unable to connect. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Cover photo ──

  const handleSetCover = async (photoId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverPhotoId: photoId }),
      });
      if (res.ok) {
        setCoverPhotoId(photoId);
      } else {
        const { error } = await res.json();
        alert(error || "Failed to set cover photo");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── Remove photo from project ──

  const handleRemovePhoto = async (photoId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (res.ok) {
        setProjectPhotos((prev) =>
          prev.filter((p) => p.photoId !== photoId),
        );
        if (coverPhotoId === photoId) {
          setCoverPhotoId(null);
        }
      } else {
        const { error } = await res.json();
        alert(error || "Failed to remove photo");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── Scene note ──

  const handleSaveNote = async (photoId: string) => {
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId,
          sceneNote: noteDraft.trim() || null,
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setProjectPhotos((prev) =>
          prev.map((p) =>
            p.photoId === photoId ? { ...p, sceneNote: data.sceneNote } : p,
          ),
        );
        setEditingNoteId(null);
      } else {
        const { error } = await res.json();
        alert(error || "Failed to save note");
      }
    } catch {
      alert("Unable to connect. Try again.");
    } finally {
      setNoteSaving(false);
    }
  };

  // ── Add photos from picker ──

  const handleAddPhotos = async (photoIds: string[]) => {
    if (photoIds.length === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds }),
      });
      if (res.ok) {
        setShowPicker(false);
        router.refresh();
      } else {
        const { error } = await res.json();
        alert(error || "Failed to add photos");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── Drag-and-drop reorder ──

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    [],
  );

  const handleDragEnter = useCallback(
    (index: number) => {
      dragCounter.current++;
      setDragOverIndex(index);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOverIndex(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      setDragIndex(null);
      setDragOverIndex(null);
      dragCounter.current = 0;

      const sourceIndex = parseInt(
        e.dataTransfer.getData("text/plain"),
        10,
      );
      if (isNaN(sourceIndex) || sourceIndex === dropIndex) return;

      // Optimistic reorder
      const reordered = [...projectPhotos];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(dropIndex, 0, moved);
      const prev = projectPhotos;
      setProjectPhotos(reordered);

      // Persist
      try {
        const res = await fetch(`/api/projects/${project.id}/photos`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoIds: reordered.map((p) => p.photoId),
          }),
        });
        if (!res.ok) {
          setProjectPhotos(prev); // revert
          const { error } = await res.json();
          alert(error || "Failed to reorder");
        }
      } catch {
        setProjectPhotos(prev); // revert
      }
    },
    [projectPhotos, project.id],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  }, []);

  // Photos in the project (by ID) for filtering the picker
  const projectPhotoIds = new Set(projectPhotos.map((p) => p.photoId));

  return (
    <>
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
        Edit Project
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr]" style={{ gap: "3rem" }}>
        {/* ── Left: Details ── */}
        <div style={{ animation: "fadeInUp 0.5s var(--ease-out) 0.1s both" }}>
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                htmlFor="proj-title"
                className="mono block text-[0.6rem] text-[var(--white-ghost)] uppercase tracking-[0.2em]"
                style={{ marginBottom: "0.75rem" }}
              >
                Title
              </label>
              <input
                id="proj-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full bg-[var(--black-surface)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--white)] placeholder:text-[var(--white-ghost)] focus:outline-none focus:border-[var(--ember)]"
                style={{
                  transition: `border-color var(--t-fast) var(--ease-out)`,
                }}
              />
            </div>

            {/* Slug */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                htmlFor="proj-slug"
                className="mono block text-[0.6rem] text-[var(--white-ghost)] uppercase tracking-[0.2em]"
                style={{ marginBottom: "0.75rem" }}
              >
                Slug
              </label>
              <input
                id="proj-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                maxLength={200}
                className="w-full bg-[var(--black-surface)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--white)] placeholder:text-[var(--white-ghost)] focus:outline-none focus:border-[var(--ember)] mono"
                style={{
                  transition: `border-color var(--t-fast) var(--ease-out)`,
                }}
              />
              <p className="mono text-[9px] text-[var(--white-ghost)] mt-1">
                /projects/{slug || "..."}
              </p>
            </div>

            {/* Description */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                htmlFor="proj-desc"
                className="mono block text-[0.6rem] text-[var(--white-ghost)] uppercase tracking-[0.2em]"
                style={{ marginBottom: "0.75rem" }}
              >
                Description
              </label>
              <textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={5000}
                className="w-full bg-[var(--black-surface)] border border-[var(--border)] rounded-sm px-3 py-2 text-sm text-[var(--white)] placeholder:text-[var(--white-ghost)] focus:outline-none focus:border-[var(--ember)] resize-none"
                style={{
                  transition: `border-color var(--t-fast) var(--ease-out)`,
                }}
                placeholder="Project description..."
              />
            </div>

            {/* Publish toggle */}
            <div className="flex items-center gap-3" style={{ marginBottom: "1.5rem" }}>
              <button
                type="button"
                role="switch"
                aria-checked={isPublished}
                onClick={() => setIsPublished(!isPublished)}
                className={`relative w-10 h-5 rounded-full border ${
                  isPublished
                    ? "bg-[var(--ember-glow)] border-[var(--ember)]"
                    : "bg-[var(--black-surface)] border-[var(--border)]"
                }`}
                style={{
                  transition: `all var(--t-fast) var(--ease-out)`,
                }}
              >
                <div
                  className={`absolute top-0.5 w-3.5 h-3.5 rounded-full ${
                    isPublished
                      ? "left-[calc(100%-18px)] bg-[var(--ember)]"
                      : "left-0.5 bg-[var(--white-ghost)]"
                  }`}
                  style={{
                    transition: `all var(--t-fast) var(--ease-out)`,
                  }}
                />
              </button>
              <span className="mono text-[0.6rem] text-[var(--white-ghost)] uppercase tracking-[0.2em]">
                {isPublished ? "Published" : "Draft"}
              </span>
            </div>

            {/* Save */}
            {saveError && (
              <p className="text-sm text-red-400" role="alert">
                {saveError}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || !title.trim()}
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
              {saving
                ? "Saving..."
                : saveSuccess
                  ? "Saved"
                  : "Save Changes"}
            </button>
          </form>
        </div>

        {/* ── Right: Photos ── */}
        <div style={{ animation: "fadeInUp 0.5s var(--ease-out) 0.2s both" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
            <h2
              className="mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--white-ghost)]"
            >
              Photos{" "}
              <span className="text-[var(--ember)] tabular-nums">
                {projectPhotos.length}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="mono text-[0.65rem] uppercase tracking-[0.2em] rounded-sm"
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
              Add Photos
            </button>
          </div>

          {projectPhotos.length === 0 ? (
            <div className="bg-[var(--black-surface)] border border-[var(--border)] rounded-sm p-10 text-center">
              <p className="text-[var(--white-ghost)] text-sm mb-3">
                No photos in this project yet.
              </p>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="mono text-[11px] uppercase tracking-[0.15em] text-[var(--ember)] hover:text-[var(--ember-hot)]"
                style={{
                  transition: `color var(--t-fast) var(--ease-out)`,
                }}
              >
                Add photos &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {projectPhotos.map((photo, index) => {
                const isCover = coverPhotoId === photo.photoId;
                const isDragging = dragIndex === index;
                const isDragOver = dragOverIndex === index;
                const isEditingNote = editingNoteId === photo.photoId;

                return (
                  <div
                    key={photo.photoId}
                    draggable={!isEditingNote}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`group relative bg-[var(--black-surface)] rounded-sm overflow-hidden cursor-grab active:cursor-grabbing ${
                      isDragging ? "opacity-30" : ""
                    } ${
                      isDragOver
                        ? "ring-2 ring-[var(--ember)]"
                        : ""
                    } ${
                      isCover
                        ? "border-2 border-[var(--ember)]"
                        : "border border-[var(--border)]"
                    }`}
                    style={{
                      transition: `opacity var(--t-fast) var(--ease-out)`,
                      animation: `fadeInUp 0.4s var(--ease-out) ${0.25 + index * 0.04}s both`,
                    }}
                  >
                    <div className="aspect-square relative">
                      {photo.thumbStorageKey ? (
                        <img
                          src={cdnUrlFor(photo.thumbStorageKey)}
                          alt={
                            photo.altText || photo.caption || "Project photo"
                          }
                          className="w-full h-full object-cover pointer-events-none"
                          loading="lazy"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[var(--black-warm)]">
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="opacity-20 text-[var(--white-ghost)]"
                          >
                            <rect
                              x="2"
                              y="3"
                              width="20"
                              height="18"
                              rx="3"
                            />
                            <circle cx="8" cy="10" r="2" />
                            <path d="M2 17l5-5 3 3 4-5 8 7" />
                          </svg>
                        </div>
                      )}

                      {/* Cover badge */}
                      {isCover && (
                        <div className="absolute top-1.5 left-1.5">
                          <span className="mono text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 bg-[var(--ember)] text-[var(--black)] rounded-sm font-medium">
                            Cover
                          </span>
                        </div>
                      )}

                      {/* Action overlay */}
                      <div
                        className="absolute inset-0 bg-[var(--black)]/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 p-2"
                        style={{
                          transition: `opacity var(--t-fast) var(--ease-out)`,
                        }}
                      >
                        {!isCover && (
                          <button
                            type="button"
                            onClick={() =>
                              handleSetCover(photo.photoId)
                            }
                            disabled={actionLoading}
                            className="mono w-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] rounded-sm text-[var(--white-dim)] hover:bg-[var(--border-strong)]"
                            style={{
                              transition: `all var(--t-fast) var(--ease-out)`,
                            }}
                          >
                            Set as Cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleRemovePhoto(photo.photoId)
                          }
                          disabled={actionLoading}
                          className="mono w-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] rounded-sm text-red-400 hover:bg-red-500/20"
                          style={{
                            transition: `all var(--t-fast) var(--ease-out)`,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Caption + scene note */}
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] text-[var(--white-ghost)] truncate">
                        {photo.caption || "Untitled"}
                      </p>
                      {isEditingNote ? (
                        <div className="mt-1">
                          <textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveNote(photo.photoId);
                              }
                              if (e.key === "Escape") setEditingNoteId(null);
                            }}
                            rows={3}
                            maxLength={2000}
                            autoFocus
                            placeholder="Scene note for this project..."
                            className="w-full bg-[var(--black-warm)] border border-[var(--border)] rounded-sm px-1.5 py-1 text-[10px] text-[var(--white)] placeholder:text-[var(--white-ghost)] focus:outline-none focus:border-[var(--ember)] resize-none"
                          />
                          <div className="flex justify-end gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              disabled={noteSaving}
                              className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--white-ghost)] hover:text-[var(--white)]"
                              style={{
                                transition: `color var(--t-fast) var(--ease-out)`,
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveNote(photo.photoId)}
                              disabled={noteSaving}
                              className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--ember)] hover:text-[var(--ember-hot)] disabled:opacity-50"
                              style={{
                                transition: `color var(--t-fast) var(--ease-out)`,
                              }}
                            >
                              {noteSaving ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(photo.photoId);
                            setNoteDraft(photo.sceneNote ?? "");
                          }}
                          className={`block w-full text-left text-[9px] truncate mt-0.5 ${
                            photo.sceneNote
                              ? "text-[var(--white-dim)] hover:text-[var(--white)]"
                              : "mono uppercase tracking-[0.1em] text-[var(--white-ghost)] opacity-60 hover:opacity-100 hover:text-[var(--ember)]"
                          }`}
                          style={{
                            transition: `all var(--t-fast) var(--ease-out)`,
                          }}
                          title={photo.sceneNote ?? "Add a scene note"}
                        >
                          {photo.sceneNote || "+ Note"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Photo Picker Modal ── */}
      {showPicker && (
        <PhotoPickerModal
          availablePhotos={availablePhotos.filter(
            (p) => !projectPhotoIds.has(p.id),
          )}
          categories={categories}
          onAdd={handleAddPhotos}
          onClose={() => setShowPicker(false)}
          loading={actionLoading}
        />
      )}
    </>
  );
}

// ── Photo Picker Modal ──

function PhotoPickerModal({
  availablePhotos,
  categories,
  onAdd,
  onClose,
  loading,
}: {
  availablePhotos: PhotoWithThumb[];
  categories: Category[];
  onAdd: (photoIds: string[]) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Note: We don't have category info per photo here from the availablePhotos prop
  // (PhotoWithThumb doesn't include categories). We'll show all photos without filtering for now.
  // Category filtering could be added by enhancing the query, but is acceptable without for single-admin.

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        className="relative bg-[var(--black-elevated)] border border-[var(--border-strong)] rounded-sm w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
          <h2
            id="picker-title"
            className="text-sm font-bold uppercase tracking-[0.2em]"
            style={{ fontFamily: "var(--f-display)" }}
          >
            Add Photos
          </h2>
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <span className="mono text-[10px] text-[var(--ember)] tabular-nums">
                {selected.size} selected
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--white-ghost)] hover:text-[var(--white)] p-1"
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
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {availablePhotos.length === 0 ? (
            <p className="text-center text-sm text-[var(--white-ghost)] py-8">
              No available photos to add.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {availablePhotos.map((photo) => {
                const isSelected = selected.has(photo.id);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => toggle(photo.id)}
                    className={`relative aspect-square rounded-sm overflow-hidden border-2 ${
                      isSelected
                        ? "border-[var(--ember)]"
                        : "border-transparent hover:border-[var(--border-strong)]"
                    }`}
                    style={{
                      transition: `border-color var(--t-fast) var(--ease-out)`,
                    }}
                  >
                    {photo.thumbStorageKey ? (
                      <img
                        src={cdnUrlFor(photo.thumbStorageKey)}
                        alt={photo.altText || photo.caption || "Photo"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-[var(--black-warm)]" />
                    )}
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--ember)] flex items-center justify-center">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="var(--black)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="mono px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-[var(--white-ghost)] hover:text-[var(--white)]"
            style={{ transition: `color var(--t-fast) var(--ease-out)` }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onAdd(Array.from(selected))}
            disabled={selected.size === 0 || loading}
            className="mono px-4 py-2 text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm bg-[var(--ember)] text-[var(--black)] hover:bg-[var(--ember-hot)] disabled:opacity-50"
            style={{ transition: `all var(--t-fast) var(--ease-out)` }}
          >
            {loading
              ? "Adding..."
              : `Add ${selected.size || ""} Photo${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
