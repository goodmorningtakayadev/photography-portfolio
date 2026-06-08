import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, type SiteSettings } from "@/db/schema";

const SETTINGS_ID = "site";

/** Defaults used when the singleton row doesn't exist yet (pre-first-save). */
const DEFAULTS: SiteSettings = {
  id: SETTINGS_ID,
  heroPhotoId: null,
  heroFocalX: 50,
  heroFocalY: 50,
  updatedAt: new Date(0),
};

/** Read the singleton site settings row, falling back to defaults. */
export async function getSiteSettings(): Promise<SiteSettings> {
  const [row] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, SETTINGS_ID))
    .limit(1);
  return row ?? DEFAULTS;
}

/** Upsert the singleton site settings row. Only provided fields are changed. */
export async function updateSiteSettings(values: {
  heroPhotoId?: string | null;
  heroFocalX?: number;
  heroFocalY?: number;
}): Promise<SiteSettings> {
  const [row] = await db
    .insert(siteSettings)
    .values({
      id: SETTINGS_ID,
      heroPhotoId: values.heroPhotoId ?? null,
      heroFocalX: values.heroFocalX ?? 50,
      heroFocalY: values.heroFocalY ?? 50,
    })
    .onConflictDoUpdate({
      target: siteSettings.id,
      // undefined fields are omitted by Drizzle; null clears the hero photo.
      set: {
        heroPhotoId: values.heroPhotoId,
        heroFocalX: values.heroFocalX,
        heroFocalY: values.heroFocalY,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}
