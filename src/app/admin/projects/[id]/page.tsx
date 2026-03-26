import { notFound } from "next/navigation";
import {
  getProjectByIdAdmin,
  getAllPhotosAdmin,
  getAllCategories,
} from "@/db/queries/admin";
import { ProjectEditor } from "@/components/admin/ProjectEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Project",
};

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, photosData, categories] = await Promise.all([
    getProjectByIdAdmin(id),
    getAllPhotosAdmin({ status: "ready", limit: 500 }),
    getAllCategories(),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div
      className="max-w-[var(--max-w)] mx-auto"
      style={{
        padding: "clamp(2rem, 4vw, 3.5rem) clamp(1.5rem, 5vw, 5rem)",
        paddingLeft: "clamp(2.5rem, 6vw, 6rem)",
      }}
    >
      <ProjectEditor
        project={project}
        availablePhotos={photosData.photos}
        categories={categories}
      />
    </div>
  );
}
