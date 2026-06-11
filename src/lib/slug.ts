/**
 * Slug generation — the one definition of how a name becomes a URL-safe slug.
 *
 * Pure and client-safe: used by category/project lifecycle modules for
 * persistence and by admin UI for live slug previews. maxLength is required
 * because it mirrors a schema constraint (categories varchar(100), project
 * slugs varchar(200)) — callers must state which column they target.
 *
 * Returns null when nothing survives (input had no alphanumeric characters).
 */
export function slugify(name: string, maxLength: number): string | null {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength);
  return slug.length > 0 ? slug : null;
}

/** Max slug length for category slugs (schema: varchar(100)). */
export const CATEGORY_SLUG_MAX = 100;

/** Max slug length for project slugs (schema: varchar(200)). */
export const PROJECT_SLUG_MAX = 200;
