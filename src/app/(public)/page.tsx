import type { Metadata } from "next";
import Home from "../../page-components/Home";
import { getHomepageView } from "@/lib/public-views";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  alternates: { canonical: siteUrl },
};

export default async function HomePage() {
  const view = await getHomepageView();

  return (
    <Home
      photos={view.featuredPhotos}
      categories={view.categories}
      featuredProjects={view.featuredProjects}
      hero={view.hero}
    />
  );
}
