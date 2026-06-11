import type { Photo } from "@/db/schema";
import { PHOTO_STATUS_DISPLAY } from "./status-display";

export function StatusBadge({ status }: { status: Photo["status"] }) {
  const config = PHOTO_STATUS_DISPLAY[status];
  return (
    <span
      className={`mono inline-flex items-center justify-center rounded-sm py-1.5 text-[9px] font-medium uppercase tracking-[0.1em] ${config.className}`}
      style={{ paddingLeft: "0.4rem", paddingRight: "0.3rem" }}
    >
      {config.label}
    </span>
  );
}
