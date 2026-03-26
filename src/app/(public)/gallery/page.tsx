import { Suspense } from "react";
import GalleryPage from "../../../page-components/GalleryPage";
import {
  getPublishedPhotosWithVariants,
  getCategoriesWithCoverPhoto,
} from "@/db/queries/photos";
import { toPhotoView, toCategoryView } from "@/lib/photo-adapter";

export const revalidate = 3600;

export default async function GalleryRoute() {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || "";

  const [photosData, categoriesData] = await Promise.all([
    getPublishedPhotosWithVariants(),
    getCategoriesWithCoverPhoto(),
  ]);

  const photos = photosData.map((p) => toPhotoView(p, cdnUrl));
  const categories = categoriesData.map((c) => toCategoryView(c, cdnUrl));

  return (
    <Suspense fallback={null}>
      <GalleryPage photos={photos} categories={categories} />
    </Suspense>
  );
}
