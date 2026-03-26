import type { Photo } from "@/db/schema";

const statusConfig: Record<
  Photo["status"],
  { label: string; className: string }
> = {
  processing: {
    label: "Processing",
    className: "bg-amber-500/20 text-amber-400",
  },
  ready: {
    label: "Ready",
    className: "bg-[var(--black)] text-[var(--ember)]",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/20 text-red-400",
  },
  archived: {
    label: "Archived",
    className: "bg-[rgba(128,122,116,0.15)] text-[var(--white-ghost)]",
  },
};

export function StatusBadge({ status }: { status: Photo["status"] }) {
  const config = statusConfig[status];
  return (
    <span
      className={`mono inline-flex items-center justify-center rounded-sm py-1.5 text-[9px] font-medium uppercase tracking-[0.1em] ${config.className}`}
      style={{ paddingLeft: "0.4rem", paddingRight: "0.3rem" }}
    >
      {config.label}
    </span>
  );
}
