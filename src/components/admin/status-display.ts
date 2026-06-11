/**
 * Status display config — one home for the status → label/colour mapping
 * shared by the photo StatusBadge and the upload queue. The photo "ready"
 * and upload "ready" treatments differ deliberately (badge-on-thumbnail
 * vs queue-row chip); both live here so a new status is added in one place.
 */

import type { Photo } from "@/db/schema";
import type { UploadStatus } from "@/lib/upload-client";

export type StatusDisplay = { label: string; className: string };

const AMBER = "bg-amber-500/20 text-amber-400";
const RED = "bg-red-500/20 text-red-400";
const MUTED = "bg-[rgba(128,122,116,0.15)] text-[var(--white-ghost)]";

export const PHOTO_STATUS_DISPLAY: Record<Photo["status"], StatusDisplay> = {
  processing: { label: "Processing", className: AMBER },
  ready: {
    label: "Ready",
    className: "bg-[var(--black)] text-[var(--ember)]",
  },
  failed: { label: "Failed", className: RED },
  archived: { label: "Archived", className: MUTED },
};

export const UPLOAD_STATUS_DISPLAY: Record<UploadStatus, StatusDisplay> = {
  queued: { label: "Queued", className: MUTED },
  presigning: { label: "Preparing", className: AMBER },
  uploading: { label: "Uploading", className: AMBER },
  confirming: { label: "Confirming", className: AMBER },
  processing: PHOTO_STATUS_DISPLAY.processing,
  ready: {
    label: "Ready",
    className: "bg-[var(--ember-glow)] text-[var(--ember)]",
  },
  failed: PHOTO_STATUS_DISPLAY.failed,
};
