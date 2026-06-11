import { afterEach, describe, expect, it, vi } from "vitest";
import { getPhoto, createCategory, deleteCategory } from "@/lib/admin-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin-api transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("unwraps the { data, error } envelope on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ data: { id: "p1", categories: [] }, error: null }),
      ),
    );
    const result = await getPhoto("p1");
    expect(result).toEqual({ ok: true, data: { id: "p1", categories: [] } });
  });

  it("sends JSON bodies with the content-type header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "c1" }, error: null }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await createCategory("Street");

    expect(fetchMock).toHaveBeenCalledWith("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Street" }),
    });
  });

  it("surfaces the server's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { data: null, error: "A category with this name or slug already exists" },
          409,
        ),
      ),
    );
    const result = await createCategory("Street");
    expect(result).toEqual({
      ok: false,
      error: "A category with this name or slug already exists",
    });
  });

  it("falls back to a status-based message when the body has no error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 502 })),
    );
    const result = await getPhoto("p1");
    expect(result).toEqual({ ok: false, error: "Request failed (502)" });
  });

  it("normalizes network failures instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    const result = await getPhoto("p1");
    expect(result).toEqual({
      ok: false,
      error: "Unable to connect. Try again.",
    });
  });

  it("treats 204 No Content as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    const result = await deleteCategory("c1");
    expect(result.ok).toBe(true);
  });
});
