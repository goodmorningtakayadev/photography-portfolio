/**
 * ISR revalidation policy — one place that knows which mutations affect
 * which public pages. Mutation routes call these named functions instead
 * of scattering revalidatePath calls inline.
 *
 * Conservative on purpose: a homepage rebuild is cheap; a stale page is
 * a UX bug. Every mutation revalidates more than the strict minimum so
 * callers never need to know which projects are "currently featured."
 */

import { revalidatePath } from "next/cache";
import type { LifecycleEvent } from "@/lib/photo-lifecycle";

/**
 * Photo changed — archive, restore, delete, field update, category
 * assignment, sort order, etc. Always revalidates the homepage and gallery;
 * if the photo participates in any projects, /projects and each
 * /projects/[slug] are revalidated too.
 */
export function revalidateForPhotoChange(opts?: {
  affectedProjectSlugs?: readonly string[];
}): void {
  revalidatePath("/");
  revalidatePath("/gallery");
  const slugs = opts?.affectedProjectSlugs ?? [];
  if (slugs.length > 0) {
    revalidatePath("/projects");
    for (const slug of slugs) revalidatePath(`/projects/${slug}`);
  }
}

/**
 * Convenience over revalidateForPhotoChange that pulls the affected slugs
 * straight off a LifecycleEvent emitted by photo-lifecycle.
 */
export function revalidateForPhotoLifecycle(event: LifecycleEvent): void {
  revalidateForPhotoChange({
    affectedProjectSlugs: event.affectedProjectSlugs,
  });
}

/**
 * Project changed — create, update, delete, slug rename, photo membership
 * change, photo reorder, cover change, publish toggle. Always revalidates
 * the homepage (featured projects), the projects index, plus each supplied
 * slug. Pass [oldSlug, newSlug] on rename and [deletedSlug] on delete so
 * the stale cached page falls out.
 */
export function revalidateForProjectChange(opts?: {
  slugs?: readonly string[];
}): void {
  revalidatePath("/");
  revalidatePath("/projects");
  for (const slug of opts?.slugs ?? []) {
    revalidatePath(`/projects/${slug}`);
  }
}

/**
 * Category changed — add, rename, reorder, delete. Categories surface on
 * the homepage (covers) and the gallery (filter tabs).
 */
export function revalidateForCategoryChange(): void {
  revalidatePath("/");
  revalidatePath("/gallery");
}
