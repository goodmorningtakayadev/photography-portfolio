/**
 * Admin API client — the named mutations admin components call instead of
 * hand-rolling fetch. Owns the transport: JSON headers, body
 * serialization, { data, error } envelope parsing, network-error
 * normalization, and 204 handling. Components keep their own
 * presentation (alerts, banners, optimistic state) and refresh policy.
 *
 * Every operation resolves to ApiResult<T> — it never throws.
 */

import type { Category, Project, SiteSettings } from "@/db/schema";
import type { PhotoWithCategories } from "@/db/queries/photos";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const CONNECT_ERROR = "Unable to connect. Try again.";

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      ...(init?.body !== undefined
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(init.body),
          }
        : {}),
    });
  } catch {
    return { ok: false, error: CONNECT_ERROR };
  }

  // 204 No Content (category delete) — success with no envelope.
  if (res.status === 204) {
    return { ok: true, data: undefined as T };
  }

  let payload: { data?: T; error?: string | null } = {};
  try {
    payload = await res.json();
  } catch {
    // fall through to status-based error below
  }

  if (!res.ok) {
    return {
      ok: false,
      error: payload.error || `Request failed (${res.status})`,
    };
  }
  return { ok: true, data: payload.data as T };
}

// ── Photos ──

export function getPhoto(id: string): Promise<ApiResult<PhotoWithCategories>> {
  return request(`/api/photos/${id}`);
}

export function updatePhoto(
  id: string,
  fields: {
    caption?: string | null;
    altText?: string | null;
    gallerySortOrder?: number;
    isPublished?: boolean;
    categoryIds?: string[];
  },
): Promise<ApiResult<{ id: string; updated: boolean }>> {
  return request(`/api/photos/${id}`, { method: "PATCH", body: fields });
}

export function archivePhoto(
  id: string,
): Promise<ApiResult<{ id: string; status: string }>> {
  return request(`/api/photos/${id}`, {
    method: "PATCH",
    body: { action: "archive" },
  });
}

export function restorePhoto(
  id: string,
): Promise<ApiResult<{ id: string; status: string }>> {
  return request(`/api/photos/${id}`, {
    method: "PATCH",
    body: { action: "restore" },
  });
}

export function reprocessPhoto(
  id: string,
): Promise<ApiResult<{ id: string; status: string }>> {
  return request(`/api/photos/${id}`, {
    method: "PATCH",
    body: { action: "reprocess" },
  });
}

export function deletePhotoPermanently(
  id: string,
): Promise<ApiResult<{ deleted: boolean; orphanedKeys?: string[] }>> {
  return request(`/api/photos/${id}`, {
    method: "DELETE",
    body: { confirm: true },
  });
}

export function bulkArchivePhotos(
  photoIds: string[],
): Promise<ApiResult<unknown>> {
  return request("/api/photos/bulk", {
    method: "POST",
    body: { action: "archive", photoIds },
  });
}

export function bulkRestorePhotos(
  photoIds: string[],
): Promise<ApiResult<unknown>> {
  return request("/api/photos/bulk", {
    method: "POST",
    body: { action: "restore", photoIds },
  });
}

export function bulkCategorizePhotos(
  photoIds: string[],
  categoryIds: string[],
): Promise<ApiResult<{ updated: number }>> {
  return request("/api/photos/bulk", {
    method: "POST",
    body: { action: "categorize", photoIds, categoryIds },
  });
}

// ── Projects ──

export function createProject(title: string): Promise<ApiResult<Project>> {
  return request("/api/projects", { method: "POST", body: { title } });
}

export function updateProject(
  id: string,
  fields: {
    title?: string;
    slug?: string;
    description?: string | null;
    isPublished?: boolean;
    coverPhotoId?: string | null;
    sortOrder?: number;
  },
): Promise<ApiResult<Project>> {
  return request(`/api/projects/${id}`, { method: "PATCH", body: fields });
}

export function deleteProject(
  id: string,
): Promise<ApiResult<{ deleted: boolean }>> {
  return request(`/api/projects/${id}`, {
    method: "DELETE",
    body: { confirm: true },
  });
}

export function addProjectPhotos(
  projectId: string,
  photoIds: string[],
): Promise<ApiResult<{ added: number }>> {
  return request(`/api/projects/${projectId}/photos`, {
    method: "POST",
    body: { photoIds },
  });
}

export function reorderProjectPhotos(
  projectId: string,
  photoIds: string[],
): Promise<ApiResult<{ reordered: number }>> {
  return request(`/api/projects/${projectId}/photos`, {
    method: "PUT",
    body: { photoIds },
  });
}

export function setProjectPhotoNote(
  projectId: string,
  photoId: string,
  sceneNote: string | null,
): Promise<ApiResult<{ photoId: string; sceneNote: string | null }>> {
  return request(`/api/projects/${projectId}/photos`, {
    method: "PATCH",
    body: { photoId, sceneNote },
  });
}

export function removeProjectPhoto(
  projectId: string,
  photoId: string,
): Promise<ApiResult<{ removed: boolean }>> {
  return request(`/api/projects/${projectId}/photos`, {
    method: "DELETE",
    body: { photoId },
  });
}

// ── Categories ──

export function createCategory(name: string): Promise<ApiResult<Category>> {
  return request("/api/categories", { method: "POST", body: { name } });
}

export function updateCategory(
  id: string,
  fields: { name?: string; slug?: string; sortOrder?: number },
): Promise<ApiResult<Category>> {
  return request(`/api/categories/${id}`, { method: "PATCH", body: fields });
}

export function deleteCategory(id: string): Promise<ApiResult<void>> {
  return request(`/api/categories/${id}`, { method: "DELETE" });
}

// ── Settings ──

export function updateSiteSettings(values: {
  heroPhotoId?: string | null;
  heroFocalX?: number;
  heroFocalY?: number;
}): Promise<ApiResult<SiteSettings>> {
  return request("/api/settings", { method: "PATCH", body: values });
}

// ── Uploads ──

export function presignUpload(
  filename: string,
  contentType: string,
): Promise<ApiResult<{ url: string; storageKey: string; photoId: string }>> {
  return request(
    `/api/uploads/presign?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`,
  );
}

export function confirmUpload(
  storageKey: string,
): Promise<ApiResult<{ id: string; status: string }>> {
  return request("/api/uploads/confirm", {
    method: "POST",
    body: { storageKey },
  });
}
