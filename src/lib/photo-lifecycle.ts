/**
 * Photo lifecycle — archive, restore, and permanent-delete operations.
 *
 * Owns the cascade rules documented in CLAUDE.md so single-photo and bulk
 * routes (and any future caller — server action, worker, CLI) share one
 * implementation. Pure Node — no Next.js imports. Returns LifecycleEvent
 * describing what changed; callers decide what to revalidate.
 */

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { photos, photoVariants, projects } from "@/db/schema";
import { deleteObject } from "@/lib/storage";
import { getProjectSlugsAffectedByPhotos } from "@/db/queries/projects";

export type ArchivedEvent = {
  kind: "archived";
  photoIds: string[];
  skippedIds: string[];
  affectedProjectSlugs: string[];
};

export type RestoredEvent = {
  kind: "restored";
  photoIds: string[];
  skippedIds: string[];
  affectedProjectSlugs: string[];
};

export type DeletedEvent = {
  kind: "permanently_deleted";
  photoIds: string[];
  skippedIds: string[];
  affectedProjectSlugs: string[];
  orphanedStorageKeys: string[];
};

export type LifecycleEvent = ArchivedEvent | RestoredEvent | DeletedEvent;

const emptyArchived: ArchivedEvent = {
  kind: "archived",
  photoIds: [],
  skippedIds: [],
  affectedProjectSlugs: [],
};

const emptyRestored: RestoredEvent = {
  kind: "restored",
  photoIds: [],
  skippedIds: [],
  affectedProjectSlugs: [],
};

const emptyDeleted: DeletedEvent = {
  kind: "permanently_deleted",
  photoIds: [],
  skippedIds: [],
  affectedProjectSlugs: [],
  orphanedStorageKeys: [],
};

export async function archivePhotos(ids: string[]): Promise<ArchivedEvent> {
  if (ids.length === 0) return emptyArchived;

  const found = await db
    .select({ id: photos.id, status: photos.status })
    .from(photos)
    .where(inArray(photos.id, ids));

  const foundIds = new Set(found.map((p) => p.id));
  const toArchive = found
    .filter((p) => p.status !== "archived")
    .map((p) => p.id);
  const skippedIds = [
    ...ids.filter((id) => !foundIds.has(id)),
    ...found.filter((p) => p.status === "archived").map((p) => p.id),
  ];

  if (toArchive.length === 0) {
    return { ...emptyArchived, skippedIds };
  }

  const affectedProjectSlugs = await getProjectSlugsAffectedByPhotos(toArchive);

  await db.batch([
    db
      .update(photos)
      .set({ status: "archived", updatedAt: new Date() })
      .where(inArray(photos.id, toArchive)),
    db
      .update(projects)
      .set({ coverPhotoId: null, updatedAt: new Date() })
      .where(inArray(projects.coverPhotoId, toArchive)),
  ]);

  return {
    kind: "archived",
    photoIds: toArchive,
    skippedIds,
    affectedProjectSlugs,
  };
}

export async function restorePhotos(ids: string[]): Promise<RestoredEvent> {
  if (ids.length === 0) return emptyRestored;

  const found = await db
    .select({ id: photos.id, status: photos.status })
    .from(photos)
    .where(inArray(photos.id, ids));

  const foundIds = new Set(found.map((p) => p.id));
  const toRestore = found
    .filter((p) => p.status === "archived")
    .map((p) => p.id);
  const skippedIds = [
    ...ids.filter((id) => !foundIds.has(id)),
    ...found.filter((p) => p.status !== "archived").map((p) => p.id),
  ];

  if (toRestore.length === 0) {
    return { ...emptyRestored, skippedIds };
  }

  // Project pages filter on status='ready', so restoring re-introduces the
  // photo to any project page that contains it. Cover refs aren't restored
  // (archive nulled them); admin re-picks a cover if desired.
  const affectedProjectSlugs = await getProjectSlugsAffectedByPhotos(toRestore);

  await db
    .update(photos)
    .set({ status: "ready", updatedAt: new Date() })
    .where(inArray(photos.id, toRestore));

  return {
    kind: "restored",
    photoIds: toRestore,
    skippedIds,
    affectedProjectSlugs,
  };
}

export async function permanentlyDeletePhotos(
  ids: string[],
): Promise<DeletedEvent> {
  if (ids.length === 0) return emptyDeleted;

  // Pre-fetch storage keys + project slugs BEFORE the FK cascade fires.
  const found = await db
    .select({ id: photos.id, storageKey: photos.storageKey })
    .from(photos)
    .where(inArray(photos.id, ids));

  const foundIdList = found.map((p) => p.id);
  const skippedIds = ids.filter((id) => !foundIdList.includes(id));

  if (foundIdList.length === 0) {
    return { ...emptyDeleted, skippedIds };
  }

  const variants = await db
    .select({ storageKey: photoVariants.storageKey })
    .from(photoVariants)
    .where(inArray(photoVariants.photoId, foundIdList));

  const affectedProjectSlugs = await getProjectSlugsAffectedByPhotos(foundIdList);

  // FK cascades handle photo_categories, project_photos, photo_variants.
  // projects.cover_photo_id is ON DELETE SET NULL.
  await db.delete(photos).where(inArray(photos.id, foundIdList));

  // Best-effort R2 cleanup. Failures don't roll back the DB delete; the DB
  // is the source of truth and orphan blobs are operationally cheap.
  const allKeys = [
    ...variants.map((v) => v.storageKey),
    ...found.map((p) => p.storageKey),
  ];
  const orphanedStorageKeys: string[] = [];
  for (const key of allKeys) {
    try {
      await deleteObject(key);
    } catch (err) {
      console.error(`[photo-lifecycle] R2 delete failed for ${key}:`, err);
      orphanedStorageKeys.push(key);
    }
  }

  return {
    kind: "permanently_deleted",
    photoIds: foundIdList,
    skippedIds,
    affectedProjectSlugs,
    orphanedStorageKeys,
  };
}

