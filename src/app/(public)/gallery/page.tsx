import { Suspense } from "react";
import type { Metadata } from "next";
import GalleryPage from "../../../page-components/GalleryPage";
import { getGalleryView } from "@/lib/public-views";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Browse the full photography portfolio — filter by category to explore street, portraits, travel, and more.",
  alternates: { canonical: `${siteUrl}/gallery` },
  openGraph: {
    title: "Gallery",
    description:
      "Browse the full photography portfolio — filter by category to explore street, portraits, travel, and more.",
    url: `${siteUrl}/gallery`,
  },
};

export default async function GalleryRoute() {
  const view = await getGalleryView();

  return (
    <Suspense fallback={null}>
      <GalleryPage photos={view.photos} categories={view.categories} />
    </Suspense>
  );
}
