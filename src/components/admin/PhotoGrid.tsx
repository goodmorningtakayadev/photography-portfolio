"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/db/schema";
import type { PhotoWithThumb } from "@/db/queries/admin";
import { cdnUrlFor } from "@/lib/image-url";
import {
  type ApiResult,
  updatePhoto,
  archivePhoto,
  restorePhoto,
  reprocessPhoto,
  deletePhotoPermanently,
  bulkArchivePhotos,
  bulkRestorePhotos,
  bulkCategorizePhotos,
} from "@/lib/admin-api";
import { StatusBadge } from "./StatusBadge";
import { PhotoEditModal } from "./PhotoEditModal";

const statusFilters: { label: string; value: string | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Ready", value: "ready" },
  { label: "Processing", value: "processing" },
  { label: "Failed", value: "failed" },
  { label: "Archived", value: "archived" },
];

export function PhotoGrid({
  photos,
  categories,
  currentStatus,
  currentPage,
  totalPages,
  total,
}: {
  photos: PhotoWithThumb[];
  categories: Category[];
  currentStatus?: string;
  currentPage: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const [editingPhoto, setEditingPhoto] = useState<PhotoWithThumb | null>(
    null,
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [bulkCategoryIds, setBulkCategoryIds] = useState<Set<string>>(
    new Set(),
  );

  // Animation: keep elements mounted during fade-out
  const [showControls, setShowControls] = useState(false);
  const [controlsExiting, setControlsExiting] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionsExiting, setBulkActionsExiting] = useState(false);
  const bulkActionsTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const hasSelection = selected.size > 0;

  // Animation: Select/Cancel button
  const [showSelectBtn, setShowSelectBtn] = useState(photos.length > 0);
  const [selectBtnExiting, setSelectBtnExiting] = useState(false);
  const [selectBtnEntering, setSelectBtnEntering] = useState(false);
  const selectBtnTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (photos.length > 0) {
      if (selectBtnTimeoutRef.current) clearTimeout(selectBtnTimeoutRef.current);
      setSelectBtnExiting(false);
      setSelectBtnEntering(true);
      setShowSelectBtn(true);
      // Allow one frame at 0 before transitioning to full
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSelectBtnEntering(false);
        });
      });
    } else if (showSelectBtn) {
      setSelectBtnExiting(true);
      selectBtnTimeoutRef.current = setTimeout(() => {
        setShowSelectBtn(false);
        setSelectBtnExiting(false);
      }, 1500);
    }
    return () => {
      if (selectBtnTimeoutRef.current) clearTimeout(selectBtnTimeoutRef.current);
    };
  }, [photos.length]);

  // Sync showControls with selectMode
  useEffect(() => {
    if (selectMode && photos.length > 0) {
      setControlsExiting(false);
      setShowControls(true);
    } else if (showControls) {
      setControlsExiting(true);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setControlsExiting(false);
      }, 1500);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [selectMode, photos.length]);

  // Sync showBulkActions with selection
  useEffect(() => {
    if (hasSelection && selectMode) {
      if (bulkActionsTimeoutRef.current) clearTimeout(bulkActionsTimeoutRef.current);
      setBulkActionsExiting(false);
      setShowBulkActions(true);
    } else if (showBulkActions) {
      setBulkActionsExiting(true);
      bulkActionsTimeoutRef.current = setTimeout(() => {
        setShowBulkActions(false);
        setBulkActionsExiting(false);
      }, 1500);
    }
    return () => {
      if (bulkActionsTimeoutRef.current) clearTimeout(bulkActionsTimeoutRef.current);
    };
  }, [hasSelection, selectMode]);

  // Grid fade-out before navigation
  const [gridFadingOut, setGridFadingOut] = useState(false);
  const gridFadeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const prevPhotosRef = useRef(photos);

  const navigateWithFade = (url: string) => {
    setGridFadingOut(true);
    gridFadeTimeoutRef.current = setTimeout(() => {
      router.push(url);
    }, 400);
  };

  // Reset fade-out only when new photo data actually arrives
  useEffect(() => {
    if (photos !== prevPhotosRef.current) {
      prevPhotosRef.current = photos;
      setGridFadingOut(false);
    }
  }, [photos]);

  useEffect(() => {
    return () => {
      if (gridFadeTimeoutRef.current) clearTimeout(gridFadeTimeoutRef.current);
    };
  }, []);

  const handleFilterChange = (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const qs = params.toString();
    navigateWithFade(`/admin/photos${qs ? `?${qs}` : ""}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams();
    if (currentStatus) params.set("status", currentStatus);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    navigateWithFade(`/admin/photos${qs ? `?${qs}` : ""}`);
  };

  const runPhotoAction = async (
    photoId: string,
    action: () => Promise<ApiResult<unknown>>,
  ) => {
    setActionLoading(photoId);
    try {
      const result = await action();
      if (!result.ok) alert(result.error);
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = (photoId: string) => {
    if (
      !confirm(
        "Permanently delete this photo? This removes all R2 files and database records. This cannot be undone.",
      )
    ) {
      return;
    }
    runPhotoAction(photoId, () => deletePhotoPermanently(photoId));
  };

  // ── Selection helpers ──

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(photos.map((p) => p.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setShowCategoryPicker(false);
    setBulkCategoryIds(new Set());
  };

  // ── Bulk actions ──

  const handleBulkArchive = async () => {
    const count = selected.size;
    if (
      !confirm(
        `Archive ${count} photo${count !== 1 ? "s" : ""}? They will be hidden from public views and any projects they belong to.`,
      )
    ) {
      return;
    }
    setBulkLoading(true);
    try {
      const result = await bulkArchivePhotos(Array.from(selected));
      if (!result.ok) alert(result.error);
      exitSelectMode();
      router.refresh();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkRestore = async () => {
    const count = selected.size;
    if (
      !confirm(
        `Restore ${count} photo${count !== 1 ? "s" : ""}? They will become available for publishing again.`,
      )
    ) {
      return;
    }
    setBulkLoading(true);
    try {
      const result = await bulkRestorePhotos(Array.from(selected));
      if (!result.ok) alert(result.error);
      exitSelectMode();
      router.refresh();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkCategorize = async () => {
    setBulkLoading(true);
    try {
      const result = await bulkCategorizePhotos(
        Array.from(selected),
        Array.from(bulkCategoryIds),
      );
      if (!result.ok) alert(result.error);
      setShowCategoryPicker(false);
      exitSelectMode();
      router.refresh();
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleBulkCategory = (id: string) => {
    setBulkCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Filter tabs + select toggle */}
      <div className="flex items-center gap-6 overflow-x-auto pb-1" style={{ marginBottom: "1.5rem" }}>
        {showSelectBtn && (
          <div
            className="flex items-center gap-6 overflow-hidden"
            style={{
              transition: "max-width 1.5s var(--ease-out), opacity 1.5s var(--ease-out)",
              maxWidth: selectBtnExiting || selectBtnEntering ? "0px" : "200px",
              opacity: selectBtnExiting || selectBtnEntering ? 0 : 1,
            }}
          >
            <button
              onClick={() =>
                selectMode ? exitSelectMode() : setSelectMode(true)
              }
              className={`mono px-4 py-2 text-xs uppercase tracking-[0.1em] rounded-md border whitespace-nowrap ${
                selectMode
                  ? "border-red-500 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                  : "border-yellow-500 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
              }`}
              style={{ transition: `all var(--t-fast) var(--ease-out)` }}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
            <div className="w-px h-5 bg-[var(--border)] flex-shrink-0" />
          </div>
        )}

        {!showSelectBtn && <div className="w-px h-5 bg-[var(--border)]" />}

        {statusFilters.map((filter) => {
          const active = currentStatus === filter.value;
          return (
            <button
              key={filter.label}
              onClick={() => handleFilterChange(filter.value)}
              className={`mono px-4 py-2 rounded-sm text-xs uppercase tracking-[0.1em] whitespace-nowrap ${
                active
                  ? "bg-[var(--ember-glow)] text-[var(--ember)] font-medium"
                  : "text-[var(--white-ghost)] hover:text-[var(--white-dim)] hover:bg-[var(--border)]"
              }`}
              style={{ transition: `all var(--t-fast) var(--ease-out)` }}
            >
              {filter.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-4 pl-4">
          <div className="w-px h-5 bg-[var(--border)]" />
          <span className="mono text-xs text-[var(--ember)] whitespace-nowrap tabular-nums tracking-wider">
            {total} {total === 1 ? "photo" : "photos"}
          </span>
        </div>
      </div>

      {/* Divider + Select mode controls */}
      {showControls && (
        <div
          className="overflow-hidden"
          style={{
            transition: "max-height 1.5s var(--ease-out), opacity 1.5s var(--ease-out)",
            maxHeight: controlsExiting ? "0px" : "200px",
            opacity: controlsExiting ? 0 : 1,
          }}
        >
        <div
          className="h-px bg-[var(--border)]"
          style={{ marginBottom: "1.5rem" }}
        />
        <div
          className="flex items-center gap-6 px-4 py-3"
          style={{
            marginBottom: "1.5rem",
            background: "rgba(11, 11, 11, 0.8)",
          }}
        >
          <button
            onClick={selectAll}
            className={`mono px-3 py-1.5 text-xs uppercase tracking-[0.1em] ${
              selected.size === photos.length
                ? "text-yellow-400 hover:text-yellow-300"
                : "text-[var(--white-ghost)] hover:text-[var(--white)]"
            }`}
            style={{ transition: `color var(--t-fast) var(--ease-out)` }}
          >
            Select All
          </button>
          {(hasSelection || showBulkActions) && (
            <button
              onClick={clearSelection}
              className="mono px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-[var(--white-ghost)] hover:text-[var(--white)]"
              style={{ transition: `color var(--t-fast) var(--ease-out)` }}
            >
              Clear
            </button>
          )}

          {showBulkActions && (
            <div
              className="flex items-center gap-6"
              style={{
                animation: bulkActionsExiting
                  ? "slideUp 1.5s var(--ease-out) both"
                  : "slideDown 1.5s var(--ease-out) both",
              }}
            >
              <div className="w-px h-5 bg-[var(--border)]" />

              <span className="mono px-3 py-1.5 text-xs text-[var(--ember)] tabular-nums tracking-wider">
                {selected.size} selected
              </span>

              <div className="w-px h-5 bg-[var(--border)]" />

              <button
                onClick={handleBulkArchive}
                disabled={bulkLoading}
                className="mono px-3 py-1.5 text-xs uppercase tracking-[0.1em] rounded-sm text-[var(--white)] hover:bg-[var(--border-strong)] disabled:opacity-50"
                style={{ transition: `all var(--t-fast) var(--ease-out)` }}
              >
                Archive
              </button>
              <button
                onClick={handleBulkRestore}
                disabled={bulkLoading}
                className="mono px-3 py-1.5 text-xs uppercase tracking-[0.1em] rounded-sm text-[var(--white)] hover:bg-[var(--border-strong)] disabled:opacity-50"
                style={{ transition: `all var(--t-fast) var(--ease-out)` }}
              >
                Restore
              </button>

              <div className="relative flex items-center">
                <button
                  onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                  disabled={bulkLoading}
                  className="mono px-3 py-1.5 text-xs uppercase tracking-[0.1em] rounded-sm text-[var(--white)] hover:bg-[var(--border-strong)] disabled:opacity-50"
                  style={{ transition: `all var(--t-fast) var(--ease-out)` }}
                >
                  Set Categories
                </button>

                {/* Category picker dropdown */}
                {showCategoryPicker && (
                  <div
                    className="absolute top-full left-0 mt-2 w-56 border border-[var(--border-strong)] rounded-sm overflow-hidden z-50"
                    style={{
                      background: "rgba(11, 11, 11, 0.95)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                    }}
                  >
                    <div className="p-3">
                      <p className="mono text-[9px] text-[var(--white-ghost)] uppercase tracking-[0.15em] mb-2">
                        Replaces existing categories
                      </p>
                      <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                        {categories.map((cat) => {
                          const checked = bulkCategoryIds.has(cat.id);
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleBulkCategory(cat.id)}
                              className={`flex items-center gap-2 px-2 py-1 rounded-sm text-left ${
                                checked
                                  ? "bg-[var(--ember-glow)]"
                                  : "hover:bg-[var(--border)]"
                              }`}
                              style={{
                                transition: `all var(--t-fast) var(--ease-out)`,
                              }}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                                  checked
                                    ? "bg-[var(--ember)] border-[var(--ember)]"
                                    : "border-[var(--white-ghost)]"
                                }`}
                              >
                                {checked && (
                                  <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                    stroke="var(--black)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M2 6l3 3 5-5" />
                                  </svg>
                                )}
                              </div>
                              <span
                                className={`mono text-[10px] ${checked ? "text-[var(--ember)]" : "text-[var(--white-dim)]"}`}
                              >
                                {cat.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 px-3 py-2 border-t border-[var(--border)]">
                      <button
                        onClick={() => setShowCategoryPicker(false)}
                        className="mono px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--white-ghost)] hover:text-[var(--white)]"
                        style={{
                          transition: `color var(--t-fast) var(--ease-out)`,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBulkCategorize}
                        disabled={bulkLoading}
                        className="mono px-3 py-1 text-[10px] uppercase tracking-[0.1em] font-medium rounded-sm bg-[var(--ember)] text-[var(--black)] hover:bg-[var(--ember-hot)] disabled:opacity-50"
                        style={{
                          transition: `all var(--t-fast) var(--ease-out)`,
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-[var(--white-ghost)] text-sm">
            {currentStatus
              ? `No ${currentStatus} photos.`
              : "No photos found."}
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3"
          style={{
            transition: "opacity 0.4s var(--ease-out), transform 0.4s var(--ease-out)",
            opacity: gridFadingOut ? 0 : 1,
            transform: gridFadingOut ? "translateY(12px)" : "none",
          }}
        >
          {photos.map((photo, i) => {
            const isLoading = actionLoading === photo.id;
            const isSelected = selected.has(photo.id);
            return (
              <div
                key={`${photo.id}-${photo.status}-${photo.isPublished}`}
                onClick={
                  selectMode ? () => toggleSelect(photo.id) : undefined
                }
                className={`group relative flex flex-col bg-[var(--black-surface)] border rounded-sm overflow-hidden ${
                  isLoading ? "opacity-50 pointer-events-none" : ""
                } ${
                  selectMode ? "cursor-pointer" : ""
                } ${
                  isSelected
                    ? "border-yellow-500 ring-1 ring-yellow-500"
                    : "border-[var(--border)]"
                }`}
                style={{
                  animation: `fadeInUp 0.6s var(--ease-out) ${0.05 * Math.min(i, 20)}s both`,
                }}
              >
                {/* Thumbnail */}
                <div className="aspect-square relative">
                  {photo.thumbStorageKey ? (
                    <img
                      src={cdnUrlFor(photo.thumbStorageKey)}
                      alt={photo.altText || photo.caption || "Photo"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--black-warm)] text-[var(--white-ghost)]">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="opacity-30"
                      >
                        <rect x="2" y="3" width="20" height="18" rx="3" />
                        <circle cx="8" cy="10" r="2" />
                        <path d="M2 17l5-5 3 3 4-5 8 7" />
                      </svg>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute top-2 left-2">
                    <StatusBadge status={photo.status} />
                  </div>

                  {/* Selection checkbox or Published indicator */}
                  {selectMode ? (
                    <div
                      className={`absolute top-2 right-2 w-5 h-5 rounded-sm border-2 flex items-center justify-center ${
                        isSelected
                          ? "bg-yellow-500 border-yellow-500"
                          : "border-[var(--white-ghost)] bg-black/40"
                      }`}
                      style={{
                        transition: `all var(--t-fast) var(--ease-out)`,
                      }}
                    >
                      {isSelected && (
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
                      )}
                    </div>
                  ) : (
                    photo.isPublished &&
                    photo.status === "ready" && (
                      <div
                        className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--ember)]"
                        title="Published"
                      />
                    )
                  )}
                </div>

                {/* Caption - bottom left of card */}
                <div className="absolute bottom-0 left-0 right-0 py-5"
                  style={{
                    paddingLeft: "0.5rem",
                    paddingRight: "0.5rem",
                    background: "rgba(11, 11, 11, 0.75)",
                    backdropFilter: "blur(12px) saturate(1.2)",
                    WebkitBackdropFilter: "blur(12px) saturate(1.2)",
                  }}
                >
                  <p className="text-[10px] text-[var(--white-dim)] truncate">
                    {photo.caption || "Untitled"}
                  </p>
                </div>

                {/* Action overlay - covers entire card (only in non-select mode) */}
                {!selectMode && (
                  <div
                    className="absolute inset-0 bg-[var(--black)]/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto flex flex-col items-center justify-center gap-1.5 p-2"
                    style={{
                      transition: `opacity var(--t-fast) var(--ease-out)`,
                    }}
                  >
                    <ActionBtn
                      label="Edit"
                      onClick={() => setEditingPhoto(photo)}
                    />
                    {(photo.status === "ready" ||
                      photo.status === "archived") && (
                      <ActionBtn
                        label={
                          photo.isPublished ? "Unpublish" : "Publish"
                        }
                        color={photo.isPublished ? "yellow" : "green"}
                        onClick={() =>
                          runPhotoAction(photo.id, () =>
                            updatePhoto(photo.id, {
                              isPublished: !photo.isPublished,
                            }),
                          )
                        }
                      />
                    )}
                    {photo.status === "ready" && (
                      <ActionBtn
                        label="Archive"
                        onClick={() =>
                          runPhotoAction(photo.id, () =>
                            archivePhoto(photo.id),
                          )
                        }
                      />
                    )}
                    {photo.status === "archived" && (
                      <ActionBtn
                        label="Restore"
                        color="green"
                        onClick={() =>
                          runPhotoAction(photo.id, () =>
                            restorePhoto(photo.id),
                          )
                        }
                      />
                    )}
                    {photo.status === "failed" && (
                      <ActionBtn
                        label="Re-process"
                        onClick={() =>
                          runPhotoAction(photo.id, () =>
                            reprocessPhoto(photo.id),
                          )
                        }
                      />
                    )}
                    <ActionBtn
                      label="Delete"
                      onClick={() => handleDelete(photo.id)}
                      danger
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className="mono px-3 py-1.5 text-xs uppercase tracking-wider rounded-sm border border-[var(--border)] text-[var(--white-dim)] hover:text-[var(--white)] hover:bg-[var(--border)] disabled:opacity-30 disabled:pointer-events-none"
            style={{ transition: `all var(--t-fast) var(--ease-out)` }}
          >
            Previous
          </button>
          <span className="mono text-xs text-[var(--white-ghost)] px-3 tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className="mono px-3 py-1.5 text-xs uppercase tracking-wider rounded-sm border border-[var(--border)] text-[var(--white-dim)] hover:text-[var(--white)] hover:bg-[var(--border)] disabled:opacity-30 disabled:pointer-events-none"
            style={{ transition: `all var(--t-fast) var(--ease-out)` }}
          >
            Next
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editingPhoto && (
        <PhotoEditModal
          photo={editingPhoto}
          categories={categories}
          onClose={() => setEditingPhoto(null)}
          onSaved={() => {
            setEditingPhoto(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

const colorMap = {
  white: { text: "text-[var(--white)]", hover: "rgba(255,255,255,0.1)" },
  yellow: { text: "text-yellow-400", hover: "rgba(250,204,21,0.1)" },
  green: { text: "text-green-400", hover: "rgba(74,222,128,0.1)" },
  red: { text: "text-red-400", hover: "rgba(239,68,68,0.15)" },
};

function ActionBtn({
  label,
  onClick,
  danger = false,
  color = "white",
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  color?: "white" | "yellow" | "green" | "red";
}) {
  const c = danger ? colorMap.red : colorMap[color];
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`mono w-full px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] rounded-sm ${c.text}`}
      style={{ transition: `background var(--t-fast) var(--ease-out)` }}
      onMouseEnter={(e) => { e.currentTarget.style.background = c.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </button>
  );
}
