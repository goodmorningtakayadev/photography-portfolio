import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// Enums
export const photoStatusEnum = pgEnum("photo_status", [
  "processing",
  "ready",
  "failed",
  "archived",
]);

export const variantTypeEnum = pgEnum("variant_type", [
  "thumb_200",
  "web_1200",
  "retina_2400",
]);

// Photos — the atomic unit
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    width: integer("width"),
    height: integer("height"),
    exifData: jsonb("exif_data"),
    blurhash: varchar("blurhash", { length: 128 }),
    caption: varchar("caption", { length: 500 }),
    altText: varchar("alt_text", { length: 500 }),
    status: photoStatusEnum("status").default("processing").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    isPublished: boolean("is_published").default(false).notNull(),
    gallerySortOrder: integer("gallery_sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("photos_exif_data_idx").using("gin", table.exifData),
    index("photos_taken_at_idx").on(table.takenAt),
    index("photos_gallery_sort_order_idx").on(table.gallerySortOrder),
  ]
);

// Photo variants — generated sizes per photo
export const photoVariants = pgTable("photo_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  photoId: uuid("photo_id")
    .references(() => photos.id, { onDelete: "cascade" })
    .notNull(),
  variantType: variantTypeEnum("variant_type").notNull(),
  storageKey: varchar("storage_key", { length: 512 }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  format: varchar("format", { length: 10 }).notNull(),
  fileSize: integer("file_size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Categories — small lookup table of predefined filter labels
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Photo-category join table
export const photoCategories = pgTable(
  "photo_categories",
  {
    photoId: uuid("photo_id")
      .references(() => photos.id, { onDelete: "cascade" })
      .notNull(),
    categoryId: uuid("category_id")
      .references(() => categories.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.photoId, table.categoryId] })]
);

// Projects — curated, ordered collections of photos
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).unique().notNull(),
  description: text("description"),
  coverPhotoId: uuid("cover_photo_id").references(() => photos.id, {
    onDelete: "set null",
  }),
  isPublished: boolean("is_published").default(false).notNull(),
  sortOrder: integer("sort_order").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Project-photo join table
export const projectPhotos = pgTable(
  "project_photos",
  {
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    photoId: uuid("photo_id")
      .references(() => photos.id, { onDelete: "cascade" })
      .notNull(),
    sortOrder: integer("sort_order").notNull(),
    // Editorial note for this photo *in this project* (scenes template).
    // Null = fall back to the photo's own alt-text-derived description.
    sceneNote: text("scene_note"),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.photoId] }),
    index("project_photos_sort_idx").on(table.projectId, table.sortOrder),
  ]
);

// Site settings — singleton row of site-wide configuration (id is always "site")
export const siteSettings = pgTable("site_settings", {
  id: varchar("id", { length: 32 }).primaryKey().default("site"),
  heroPhotoId: uuid("hero_photo_id").references(() => photos.id, {
    onDelete: "set null",
  }),
  // object-position percentages (0–100); 50/50 = centered crop
  heroFocalX: integer("hero_focal_x").notNull().default(50),
  heroFocalY: integer("hero_focal_y").notNull().default(50),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Inferred types
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type PhotoVariant = typeof photoVariants.$inferSelect;
export type NewPhotoVariant = typeof photoVariants.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectPhoto = typeof projectPhotos.$inferSelect;
export type NewProjectPhoto = typeof projectPhotos.$inferInsert;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type NewSiteSettings = typeof siteSettings.$inferInsert;
