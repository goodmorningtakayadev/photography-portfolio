import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { ProjectDetailPage } from "../../../../page-components/ProjectDetailPage";
import {
  getProjectViewBySlug,
  listPublishedProjectSlugs,
} from "@/lib/public-views";
import { getImageUrl, getImageSrcSet } from "../../../../utils/imageHelpers";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await listPublishedProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectViewBySlug(slug);
  if (!project) return { title: "Project Not Found" };

  const description =
    project.description || `${project.title} — a photography project`;
  const coverImageUrl = project.coverPhoto?._displayUrl ?? undefined;

  return {
    title: project.title,
    description,
    alternates: { canonical: `${siteUrl}/projects/${slug}` },
    openGraph: {
      title: project.title,
      description,
      url: `${siteUrl}/projects/${slug}`,
      ...(coverImageUrl ? { images: [coverImageUrl] } : {}),
    },
  };
}

export default async function ProjectDetailRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectViewBySlug(slug);

  if (!project) {
    notFound();
  }

  // Preload the full-bleed hero (photos[0]) — the page's LCP. Mirrors the
  // <img srcset/sizes> the hero renders.
  const heroPhoto = project.photos[0];
  if (heroPhoto) {
    preload(getImageUrl(heroPhoto, "full"), {
      as: "image",
      imageSrcSet: getImageSrcSet(heroPhoto) || undefined,
      imageSizes: "100vw",
      fetchPriority: "high",
    });
  }

  return (
    <ProjectDetailPage
      /* key forces a remount on client navigation between projects —
         the page's one-shot reveal/rail/parallax effects must re-run for
         the new scene nodes or images stay hidden behind their clip-path */
      key={project.slug}
      title={project.title}
      slug={project.slug}
      description={project.description}
      publishedAt={project.publishedAt?.toISOString() || null}
      photos={project.photos}
      coverPhoto={project.coverPhoto}
      photoCount={project.photos.length}
      prevProject={
        project.prevSlug !== null && project.prevTitle !== null
          ? { slug: project.prevSlug, title: project.prevTitle }
          : null
      }
      nextProject={
        project.nextSlug !== null && project.nextTitle !== null
          ? { slug: project.nextSlug, title: project.nextTitle }
          : null
      }
      nextCoverUrl={project.nextCoverUrl}
    />
  );
}
