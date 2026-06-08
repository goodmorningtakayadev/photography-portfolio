import type { MetadataRoute } from "next";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const publishedProjects = await db
    .select({ slug: projects.slug, publishedAt: projects.publishedAt })
    .from(projects)
    .where(eq(projects.isPublished, true));

  const projectPages: MetadataRoute.Sitemap = publishedProjects.map(
    (project) => ({
      url: `${baseUrl}/projects/${project.slug}`,
      lastModified: project.publishedAt || new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    }),
  );

  return [...staticPages, ...projectPages];
}
