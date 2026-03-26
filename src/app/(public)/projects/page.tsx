import { ProjectsPage } from "../../../page-components/ProjectsPage";
import { getPublishedProjectsWithPhotos } from "@/db/queries/photos";
import { toPhotoView } from "@/lib/photo-adapter";

export const revalidate = 3600;

export const metadata = {
  title: "Projects",
  description: "Curated photography projects and series",
};

export default async function ProjectsRoute() {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || "";
  const projectsData = await getPublishedProjectsWithPhotos();

  const projects = projectsData.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description || "",
    coverPhoto: p.coverPhoto ? toPhotoView(p.coverPhoto, cdnUrl) : null,
    photoCount: p.photos.length,
  }));

  return <ProjectsPage projects={projects} />;
}
