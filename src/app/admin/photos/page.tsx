import { getAllPhotosAdmin } from "@/db/queries/admin";
import { getAllCategories } from "@/db/queries/categories";
import { PhotoGrid } from "@/components/admin/PhotoGrid";
import type { Photo } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Photos",
};

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;

  const validStatuses = ["processing", "ready", "failed", "archived"];
  const status = validStatuses.includes(params.status ?? "")
    ? (params.status as Photo["status"])
    : undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [photosData, categories] = await Promise.all([
    getAllPhotosAdmin({ status, page }),
    getAllCategories(),
  ]);

  return (
    <div
      className="max-w-[var(--max-w)] mx-auto"
      style={{
        padding: "clamp(2rem, 4vw, 3.5rem) clamp(1.5rem, 5vw, 5rem)",
        paddingLeft: "clamp(2.5rem, 6vw, 6rem)",
      }}
    >
      <h1
        className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold uppercase tracking-tight leading-none text-[var(--white)]"
        style={{ fontFamily: "var(--f-display)", letterSpacing: "-0.02em", marginBottom: "3rem", animation: "fadeInUp 0.5s var(--ease-out) both" }}
      >Photos</h1>
      <PhotoGrid
        photos={photosData.photos}
        categories={categories}
        currentStatus={status}
        currentPage={photosData.page}
        totalPages={photosData.totalPages}
        total={photosData.total}
      />
    </div>
  );
}
