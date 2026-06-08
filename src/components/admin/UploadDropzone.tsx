"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_SIZE } from "@/lib/constants";

// --- Types ---

type UploadStatus =
  | "queued"
  | "presigning"
  | "uploading"
  | "confirming"
  | "processing"
  | "ready"
  | "failed";

interface UploadItem {
  id: string;
  file: File;
  preview: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  photoId?: string;
  thumbUrl?: string;
}

const TERMINAL_STATUSES: UploadStatus[] = ["ready", "failed", "queued"];
const ACTIVE_STATUSES: UploadStatus[] = [
  "presigning",
  "uploading",
  "confirming",
  "processing",
];
const MAX_CONCURRENT = 3;
const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 120000;
const XHR_TIMEOUT = 300000; // 5 minutes

// --- Status display config ---

const statusDisplay: Record<
  UploadStatus,
  { label: string; className: string }
> = {
  queued: {
    label: "Queued",
    className: "bg-[rgba(128,122,116,0.15)] text-[var(--white-ghost)]",
  },
  presigning: {
    label: "Preparing",
    className: "bg-amber-500/20 text-amber-400",
  },
  uploading: {
    label: "Uploading",
    className: "bg-amber-500/20 text-amber-400",
  },
  confirming: {
    label: "Confirming",
    className: "bg-amber-500/20 text-amber-400",
  },
  processing: {
    label: "Processing",
    className: "bg-amber-500/20 text-amber-400",
  },
  ready: {
    label: "Ready",
    className: "bg-[var(--ember-glow)] text-[var(--ember)]",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/20 text-red-400",
  },
};

// --- Component ---

export function UploadDropzone() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [rejections, setRejections] = useState<
    { name: string; reason: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pollTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // --- Helpers ---

  const updateItem = useCallback(
    (id: string, updates: Partial<UploadItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  // --- beforeunload guard (audit-added) ---

  useEffect(() => {
    const hasActive = items.some((item) =>
      ACTIVE_STATUSES.includes(item.status),
    );

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    if (hasActive) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [items]);

  // --- Cleanup object URLs on unmount ---

  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.preview));
      pollTimersRef.current.forEach((timer) => clearTimeout(timer));
      abortControllersRef.current.forEach((ctrl) => ctrl.abort());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- File validation ---

  const validateAndAddFiles = useCallback(
    (files: FileList | File[]) => {
      const newItems: UploadItem[] = [];
      const newRejections: { name: string; reason: string }[] = [];

      Array.from(files).forEach((file) => {
        if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
          newRejections.push({
            name: file.name,
            reason: `Unsupported type: ${file.type || "unknown"}`,
          });
          return;
        }
        if (file.size > MAX_UPLOAD_SIZE) {
          newRejections.push({
            name: file.name,
            reason: `Exceeds ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB limit`,
          });
          return;
        }
        newItems.push({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          status: "queued",
          progress: 0,
        });
      });

      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
      }
      if (newRejections.length > 0) {
        setRejections((prev) => [...prev, ...newRejections]);
        // Auto-clear rejections after 8 seconds
        setTimeout(() => {
          setRejections((prev) =>
            prev.filter((r) => !newRejections.includes(r)),
          );
        }, 8000);
      }
    },
    [],
  );

  // --- Drag events ---

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        validateAndAddFiles(e.dataTransfer.files);
      }
    },
    [validateAndAddFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        validateAndAddFiles(e.target.files);
        e.target.value = "";
      }
    },
    [validateAndAddFiles],
  );

  // --- Upload pipeline per file ---

  const uploadFile = useCallback(
    async (item: UploadItem) => {
      const { id, file } = item;

      // Stage 1: Presign
      try {
        updateItem(id, { status: "presigning", progress: 0 });
        const presignRes = await fetch(
          `/api/uploads/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
        );
        if (!presignRes.ok) {
          const body = await presignRes.json().catch(() => ({}));
          throw new Error(
            body.error || `Server returned ${presignRes.status}`,
          );
        }
        const { data: presignData } = await presignRes.json();
        if (!presignData?.url || !presignData?.storageKey || !presignData?.photoId) {
          throw new Error("Invalid presign response");
        }

        updateItem(id, { photoId: presignData.photoId });

        // Stage 2: Upload to R2 via XHR
        updateItem(id, { status: "uploading", progress: 0 });
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const controller = new AbortController();
          abortControllersRef.current.set(id, controller);

          xhr.timeout = XHR_TIMEOUT;

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              updateItem(id, { progress: pct });
            }
          };

          xhr.onload = () => {
            abortControllersRef.current.delete(id);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(
                new Error(`R2 returned ${xhr.status}: ${xhr.statusText}`),
              );
            }
          };

          xhr.onerror = () => {
            abortControllersRef.current.delete(id);
            reject(new Error("Network error during upload"));
          };

          xhr.ontimeout = () => {
            abortControllersRef.current.delete(id);
            reject(new Error("Upload timed out"));
          };

          controller.signal.addEventListener("abort", () => {
            xhr.abort();
            reject(new Error("Upload aborted"));
          });

          xhr.open("PUT", presignData.url);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });

        // Stage 3: Confirm
        updateItem(id, { status: "confirming", progress: 100 });
        const confirmRes = await fetch("/api/uploads/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storageKey: presignData.storageKey }),
        });
        if (!confirmRes.ok) {
          const body = await confirmRes.json().catch(() => ({}));
          throw new Error(
            `Confirm failed: ${body.error || `status ${confirmRes.status}`}`,
          );
        }

        // Stage 4: Poll for processing
        updateItem(id, { status: "processing", progress: 100 });
        const startTime = Date.now();
        const photoId = presignData.photoId;

        const poll = () => {
          if (Date.now() - startTime > POLL_TIMEOUT) {
            updateItem(id, {
              status: "failed",
              error: "Processing timed out after 2 minutes",
            });
            return;
          }

          const timer = setTimeout(async () => {
            try {
              const res = await fetch(`/api/photos/${photoId}`);
              if (!res.ok) {
                poll(); // retry on transient failure
                return;
              }
              const { data } = await res.json();
              if (data?.status === "ready") {
                // Construct CDN URL from known pattern (audit-added)
                const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || "";
                const thumbUrl = `${cdnUrl}/photos/${photoId}/thumb_200.webp`;
                updateItem(id, { status: "ready", thumbUrl });
                pollTimersRef.current.delete(id);
              } else if (data?.status === "failed") {
                updateItem(id, {
                  status: "failed",
                  error: "Image processing failed",
                });
                pollTimersRef.current.delete(id);
              } else {
                poll();
              }
            } catch {
              poll(); // retry on network error
            }
          }, POLL_INTERVAL);

          pollTimersRef.current.set(id, timer);
        };

        poll();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        updateItem(id, { status: "failed", error: message });
      }
    },
    [updateItem],
  );

  // --- Start all uploads (max concurrent) ---

  const startUpload = useCallback(async () => {
    setIsUploading(true);

    const queued = items.filter((item) => item.status === "queued");
    let active = 0;
    let index = 0;

    const runNext = async (): Promise<void> => {
      if (index >= queued.length) return;
      const item = queued[index++];
      active++;
      try {
        await uploadFile(item);
      } finally {
        active--;
        await runNext();
      }
    };

    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT, queued.length) },
      () => runNext(),
    );

    await Promise.all(workers);
    setIsUploading(false);
  }, [items, uploadFile]);

  // --- Retry ---

  const retryItem = useCallback(
    (id: string) => {
      updateItem(id, { status: "queued", progress: 0, error: undefined });
    },
    [updateItem],
  );

  // --- Remove item ---

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((i) => i.id !== id);
    });
    // Clean up any active poll/abort
    const timer = pollTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      pollTimersRef.current.delete(id);
    }
    const ctrl = abortControllersRef.current.get(id);
    if (ctrl) {
      ctrl.abort();
      abortControllersRef.current.delete(id);
    }
  }, []);

  // --- Clear completed ---

  const clearCompleted = useCallback(() => {
    setItems((prev) => {
      const completed = prev.filter((i) => i.status === "ready");
      completed.forEach((i) => URL.revokeObjectURL(i.preview));
      return prev.filter((i) => i.status !== "ready");
    });
  }, []);

  // --- Derived state ---

  const queuedCount = items.filter((i) => i.status === "queued").length;
  const hasCompleted = items.some((i) => i.status === "ready");
  const hasQueued = queuedCount > 0;
  const hasItems = items.length > 0;

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload photos by dragging files here or clicking to browse"
        className="relative cursor-pointer group flex flex-col items-center justify-center"
        style={{
          border: isDragging
            ? "2px solid var(--ember)"
            : "2px dashed var(--border-strong)",
          borderRadius: "4px",
          padding: "clamp(3rem, 6vw, 5rem) 2rem",
          background: isDragging
            ? "rgba(126, 20, 32, 0.04)"
            : "rgba(17, 17, 16, 0.4)",
          transition: `border-color var(--t-fast) var(--ease-out), background var(--t-fast) var(--ease-out)`,
          textAlign: "center",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={[...ALLOWED_UPLOAD_TYPES].join(",")}
          onChange={handleFileInput}
          className="hidden"
          aria-hidden="true"
        />

        {/* Upload icon */}
        <div
          className="mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-full border"
          style={{
            borderColor: isDragging ? "var(--ember)" : "var(--border-strong)",
            boxShadow: isDragging
              ? "0 0 20px rgba(126, 20, 32, 0.15), inset 0 0 20px rgba(126, 20, 32, 0.05)"
              : "none",
            transition: `border-color var(--t-fast) var(--ease-out), box-shadow var(--t-fast) var(--ease-out)`,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: isDragging ? "var(--ember)" : "var(--white-ghost)",
              transition: `color var(--t-fast) var(--ease-out)`,
            }}
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <p
          className="text-sm mb-2"
          style={{
            fontFamily: "var(--f-body)",
            color: isDragging ? "var(--ember)" : "var(--white-dim)",
            transition: `color var(--t-fast) var(--ease-out)`,
          }}
        >
          {isDragging
            ? "Drop files to add to queue"
            : "Drag photos here or click to browse"}
        </p>
        <p
          className="mono text-[0.55rem] uppercase tracking-[0.2em] text-[var(--white-ghost)]"
        >
          JPEG, PNG, WebP, AVIF, TIFF &middot; Max{" "}
          {MAX_UPLOAD_SIZE / (1024 * 1024)}MB
        </p>
      </div>

      {/* Rejection errors */}
      {rejections.length > 0 && (
        <div
          className="space-y-1"
          style={{
            animation: "fadeInUp 0.3s var(--ease-out) both",
          }}
        >
          {rejections.map((r, i) => (
            <div
              key={`${r.name}-${i}`}
              className="flex items-center gap-3 px-4 py-2.5 rounded-sm bg-red-500/10 border border-red-500/20"
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
              <span
                className="text-xs text-red-400 truncate"
                style={{ fontFamily: "var(--f-body)" }}
              >
                <span className="font-medium">{r.name}</span> — {r.reason}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      {hasItems && (
        <div
          className="flex items-center gap-4"
          style={{
            marginTop: "1.5rem",
            marginBottom: "1.5rem",
            animation: "fadeInUp 0.3s var(--ease-out) both",
          }}
        >
          {hasQueued && (
            <button
              onClick={startUpload}
              disabled={isUploading}
              className="mono inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.2em] rounded-sm disabled:opacity-30 disabled:cursor-not-allowed"
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
              {isUploading ? (
                <>
                  <Spinner />
                  Uploading...
                </>
              ) : (
                `Upload ${queuedCount} file${queuedCount > 1 ? "s" : ""}`
              )}
            </button>
          )}
          {hasCompleted && (
            <button
              onClick={clearCompleted}
              className="mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--white-ghost)] hover:text-[var(--white-dim)]"
              style={{ transition: `color var(--t-fast) var(--ease-out)` }}
            >
              Clear completed
            </button>
          )}
        </div>
      )}

      {/* Upload queue */}
      {hasItems && (
        <div className="space-y-2">
          {items.map((item) => (
            <UploadQueueItem
              key={item.id}
              item={item}
              onRetry={retryItem}
              onRemove={removeItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Queue item component ---

function UploadQueueItem({
  item,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const config = statusDisplay[item.status];
  const isActive = ACTIVE_STATUSES.includes(item.status);
  const showProgress = item.status === "uploading";

  return (
    <div
      className="flex items-center gap-4 rounded-sm overflow-hidden"
      style={{
        background: "rgba(17, 17, 16, 0.5)",
        border: "1px solid var(--border)",
        padding: "0.75rem 1rem",
        animation: "fadeInUp 0.4s var(--ease-out) both",
      }}
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-sm overflow-hidden shrink-0 bg-[var(--black-warm)]">
        {item.status === "ready" && item.thumbUrl ? (
          <img
            src={item.thumbUrl}
            alt={item.file.name}
            className="w-full h-full object-cover"
            style={{
              filter: "saturate(0.7) contrast(1.1) brightness(0.85)",
            }}
          />
        ) : (
          <img
            src={item.preview}
            alt={item.file.name}
            className="w-full h-full object-cover"
            style={{
              filter:
                item.status === "failed"
                  ? "saturate(0) brightness(0.4)"
                  : "saturate(0.5) contrast(1.1) brightness(0.7)",
            }}
          />
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p
            className="text-xs text-[var(--white-dim)] truncate"
            style={{ fontFamily: "var(--f-body)" }}
          >
            {item.file.name}
          </p>
          <span
            className="mono text-[0.5rem] text-[var(--white-ghost)] shrink-0"
          >
            {(item.file.size / (1024 * 1024)).toFixed(1)}MB
          </span>
        </div>

        {/* Progress bar */}
        {(showProgress || isActive) && (
          <div
            className="h-[3px] rounded-full overflow-hidden bg-[var(--border)]"
            style={{ marginTop: "4px" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: showProgress ? `${item.progress}%` : "100%",
                background:
                  item.status === "uploading"
                    ? "var(--ember)"
                    : "var(--white-ghost)",
                transition: showProgress
                  ? "width 0.3s ease-out"
                  : "none",
                animation:
                  !showProgress && isActive
                    ? "pulse 2s ease-in-out infinite"
                    : "none",
                opacity: !showProgress && isActive ? 0.4 : 1,
              }}
            />
          </div>
        )}

        {/* Error message */}
        {item.error && (
          <p
            className="text-[10px] text-red-400 mt-1 truncate"
            style={{ fontFamily: "var(--f-body)" }}
            title={item.error}
          >
            {item.error}
          </p>
        )}
      </div>

      {/* Status badge */}
      <span
        className={`mono inline-flex items-center rounded-sm px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] shrink-0 ${config.className}`}
      >
        {isActive && item.status !== "uploading" && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
        )}
        {config.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {item.status === "failed" && (
          <button
            onClick={() => onRetry(item.id)}
            className="mono text-[0.55rem] uppercase tracking-[0.15em] text-[var(--ember)] hover:text-[var(--ember-hot)] px-2 py-1"
            style={{ transition: `color var(--t-fast) var(--ease-out)` }}
            title="Retry upload"
          >
            Retry
          </button>
        )}
        {TERMINAL_STATUSES.includes(item.status) && (
          <button
            onClick={() => onRemove(item.id)}
            className="text-[var(--white-ghost)] hover:text-red-400 p-1"
            style={{ transition: `color var(--t-fast) var(--ease-out)` }}
            title="Remove from queue"
            aria-label={`Remove ${item.file.name}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="3.5" y1="3.5" x2="10.5" y2="10.5" />
              <line x1="10.5" y1="3.5" x2="3.5" y2="10.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// --- Spinner ---

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="animate-spin"
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="24 12"
        strokeLinecap="round"
      />
    </svg>
  );
}
