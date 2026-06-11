import type { Metadata } from "next";
import { preload } from "react-dom";
import Home from "../../page-components/Home";
import { getHomepageView } from "@/lib/public-views";
import { getImageUrl, getImageSrcSet } from "../../utils/imageHelpers";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  alternates: { canonical: siteUrl },
};

export default async function HomePage() {
  const view = await getHomepageView();

  // Preload the hero — it's the LCP and would otherwise wait for hydration
  // discovery. Mirrors the <img srcset/sizes> the Home hero renders.
  const heroPhoto = view.hero.photo ?? view.featuredPhotos[0];
  if (heroPhoto) {
    preload(getImageUrl(heroPhoto, "full"), {
      as: "image",
      imageSrcSet: getImageSrcSet(heroPhoto) || undefined,
      imageSizes: "100vw",
      fetchPriority: "high",
    });
  }

  return (
    <Home
      photos={view.featuredPhotos}
      categories={view.categories}
      featuredProjects={view.featuredProjects}
      hero={view.hero}
    />
  );
}
