import { readFileSync } from "fs";
import { resolve } from "path";
import ws from "ws";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import {
  photos,
  categories,
  photoCategories,
  projects,
  projectPhotos,
} from "../src/db/schema";

// Configure WebSocket for Node.js environment
neonConfig.webSocketConstructor = ws;

// ── Types for photos.json ──────────────────────────────────────────────────

interface JsonPhoto {
  id: string;
  title: string;
  category: string;
  url: string;
  thumbnail: string;
  aspectRatio: string;
  featured: boolean;
  heroImage: boolean;
  date: string;
  description: string;
  tags: string[];
  order: number;
  published: boolean;
}

interface JsonCollection {
  id: string;
  name: string;
  description: string;
  coverPhotoId: string;
  photoIds: string[];
  date: string;
  tags: string[];
}

interface JsonData {
  categories: { id: string; name: string; description: string; coverPhoto: string }[];
  photos: JsonPhoto[];
  collections: JsonCollection[];
}

// ── Main ───────────────────────────────────────────────────────────────────

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is required.");
    console.error("Set it in .env.local or pass it inline:");
    console.error("  DATABASE_URL=postgresql://... pnpm db:seed");
    process.exit(1);
  }

  // Read photos.json
  const dataPath = resolve(__dirname, "../src/data/photos.json");
  const raw: JsonData = JSON.parse(readFileSync(dataPath, "utf-8"));

  console.log(`Loaded: ${raw.photos.length} photos, ${raw.categories.length} categories, ${raw.collections.length} collections`);

  // Warn about dropped fields
  const droppedFields = ["featured", "heroImage", "tags", "aspectRatio", "thumbnail"];
  console.warn(`⚠  Fields not in DB schema (data will be dropped): ${droppedFields.join(", ")}`);
  console.warn("   - featured/heroImage: Phase 6 homepage will use gallery_sort_order + limit instead");
  console.warn("   - tags: categorization uses photo_categories join table, not freeform tags");

  // Create pool-based connection (supports transactions)
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle({ client: pool });

  try {
    await db.transaction(async (tx) => {
      // Truncate in reverse dependency order
      console.log("Truncating existing data...");
      await tx.execute(sql`TRUNCATE TABLE project_photos CASCADE`);
      await tx.execute(sql`TRUNCATE TABLE photo_categories CASCADE`);
      await tx.execute(sql`TRUNCATE TABLE photo_variants CASCADE`);
      await tx.execute(sql`TRUNCATE TABLE projects CASCADE`);
      await tx.execute(sql`TRUNCATE TABLE photos CASCADE`);
      await tx.execute(sql`TRUNCATE TABLE categories CASCADE`);

      // ── Insert categories ──────────────────────────────────────────

      console.log("Inserting categories...");
      const categoryMap = new Map<string, string>(); // slug → uuid

      const categoryRows = raw.categories.map((cat, i) => ({
        name: cat.name,
        slug: cat.id,
        sortOrder: i + 1,
      }));

      const insertedCategories = await tx
        .insert(categories)
        .values(categoryRows)
        .returning({ id: categories.id, slug: categories.slug });

      for (const cat of insertedCategories) {
        categoryMap.set(cat.slug, cat.id);
      }
      console.log(`  ✓ ${insertedCategories.length} categories`);

      // ── Insert photos ──────────────────────────────────────────────

      console.log("Inserting photos...");
      const jsonIdToUuid = new Map<string, string>(); // "1" → uuid

      const photoRows = raw.photos.map((photo) => ({
        storageKey: photo.url.replace(/^\//, ""), // strip leading slash
        caption: photo.title,
        altText: photo.description || photo.title,
        status: "ready" as const,
        takenAt: photo.date ? new Date(photo.date) : null,
        isPublished: photo.published,
        gallerySortOrder: photo.order,
      }));

      const insertedPhotos = await tx
        .insert(photos)
        .values(photoRows)
        .returning({ id: photos.id });

      // Map json IDs to DB UUIDs (order preserved)
      for (let i = 0; i < raw.photos.length; i++) {
        jsonIdToUuid.set(raw.photos[i].id, insertedPhotos[i].id);
      }
      console.log(`  ✓ ${insertedPhotos.length} photos`);

      // ── Insert photo-category relationships ────────────────────────

      console.log("Inserting photo-category relationships...");
      const photoCategoryRows = raw.photos
        .filter((photo) => categoryMap.has(photo.category))
        .map((photo) => ({
          photoId: jsonIdToUuid.get(photo.id)!,
          categoryId: categoryMap.get(photo.category)!,
        }));

      if (photoCategoryRows.length > 0) {
        await tx.insert(photoCategories).values(photoCategoryRows);
      }
      console.log(`  ✓ ${photoCategoryRows.length} photo-category links`);

      // ── Insert projects ────────────────────────────────────────────

      console.log("Inserting projects...");
      const projectRows = raw.collections.map((col, i) => ({
        title: col.name,
        slug: col.id,
        description: col.description || null,
        coverPhotoId: col.coverPhotoId
          ? jsonIdToUuid.get(col.coverPhotoId) ?? null
          : null,
        isPublished: true,
        sortOrder: i + 1,
        publishedAt: new Date(),
      }));

      const insertedProjects = await tx
        .insert(projects)
        .values(projectRows)
        .returning({ id: projects.id, slug: projects.slug });

      const projectSlugToUuid = new Map<string, string>();
      for (const proj of insertedProjects) {
        projectSlugToUuid.set(proj.slug, proj.id);
      }
      console.log(`  ✓ ${insertedProjects.length} projects`);

      // ── Insert project-photo relationships ─────────────────────────

      console.log("Inserting project-photo relationships...");
      const projectPhotoRows: {
        projectId: string;
        photoId: string;
        sortOrder: number;
      }[] = [];

      for (const col of raw.collections) {
        const projectId = projectSlugToUuid.get(col.id);
        if (!projectId) continue;

        for (let i = 0; i < col.photoIds.length; i++) {
          const photoId = jsonIdToUuid.get(col.photoIds[i]);
          if (!photoId) continue;

          projectPhotoRows.push({
            projectId,
            photoId,
            sortOrder: i + 1,
          });
        }
      }

      if (projectPhotoRows.length > 0) {
        await tx.insert(projectPhotos).values(projectPhotoRows);
      }
      console.log(`  ✓ ${projectPhotoRows.length} project-photo links`);
    });

    console.log("\n✓ Seed complete!");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
