import { notFound } from "next/navigation";
import { ProjectDetailPage } from "../../../../page-components/ProjectDetailPage";
import { getPublishedProjectsWithPhotos } from "@/db/queries/photos";
import { toPhotoView } from "@/lib/photo-adapter";

export const revalidate = 3600;

export async function generateStaticParams() {
  const projectsData = await getPublishedProjectsWithPhotos();
  return projectsData.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const projectsData = await getPublishedProjectsWithPhotos();
  const project = projectsData.find((p) => p.slug === slug);
  if (!project) return { title: "Project Not Found" };
  return {
    title: project.title,
    description: project.description || `${project.title} — a photography project`,
  };
}

export default async function ProjectDetailRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || "";

  const projectsData = await getPublishedProjectsWithPhotos();
  const projectIndex = projectsData.findIndex((p) => p.slug === slug);

  if (projectIndex === -1) {
    notFound();
  }

  const project = projectsData[projectIndex];
  const photos = project.photos.map((ph) => toPhotoView(ph, cdnUrl));
  const coverPhoto = project.coverPhoto
    ? toPhotoView(project.coverPhoto, cdnUrl)
    : null;

  // Adjacent projects for end card navigation
  const prevProject = projectIndex > 0
    ? { slug: projectsData[projectIndex - 1].slug, title: projectsData[projectIndex - 1].title }
    : null;
  const nextProject = projectIndex < projectsData.length - 1
    ? { slug: projectsData[projectIndex + 1].slug, title: projectsData[projectIndex + 1].title }
    : null;

  return (
    <ProjectDetailPage
      title={project.title}
      slug={project.slug}
      description={project.description || ""}
      publishedAt={project.publishedAt?.toISOString() || null}
      photos={photos}
      coverPhoto={coverPhoto}
      photoCount={photos.length}
      prevProject={prevProject}
      nextProject={nextProject}
    />
  );
}
