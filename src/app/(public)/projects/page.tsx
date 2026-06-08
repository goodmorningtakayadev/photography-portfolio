import type { Metadata } from "next";
import { ProjectsPage } from "../../../page-components/ProjectsPage";
import { listProjectCards } from "@/lib/public-views";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Projects",
  description: "Curated photography projects and series",
  alternates: { canonical: `${siteUrl}/projects` },
  openGraph: {
    title: "Projects",
    description: "Curated photography projects and series",
    url: `${siteUrl}/projects`,
  },
};

export default async function ProjectsRoute() {
  const projects = await listProjectCards();
  return <ProjectsPage projects={projects} />;
}
