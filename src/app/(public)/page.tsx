import Home from "../../page-components/Home";
import {
  getFeaturedPhotosWithVariants,
  getCategoriesWithCoverPhoto,
  getPublishedProjectsWithPhotos,
} from "@/db/queries/photos";
import { toPhotoView, toCategoryView } from "@/lib/photo-adapter";

export const revalidate = 3600;

export default async function HomePage() {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || "";

  const [photosData, categoriesData, projectsData] = await Promise.all([
    getFeaturedPhotosWithVariants(6),
    getCategoriesWithCoverPhoto(),
    getPublishedProjectsWithPhotos(),
  ]);

  const photos = photosData.map((p) => toPhotoView(p, cdnUrl));
  const categories = categoriesData.map((c) => toCategoryView(c, cdnUrl));

  const featuredProjects = projectsData.slice(0, 3).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description || "",
    coverPhoto: p.coverPhoto ? toPhotoView(p.coverPhoto, cdnUrl) : null,
  }));

  return <Home photos={photos} categories={categories} featuredProjects={featuredProjects} />;
}
