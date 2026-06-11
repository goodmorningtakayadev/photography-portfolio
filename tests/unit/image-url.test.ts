import { afterEach, describe, expect, it, vi } from "vitest";
import { cdnUrlFor, variantStorageKey } from "@/lib/image-url";

describe("cdnUrlFor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefixes the CDN domain when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_URL", "https://cdn.example.com");
    expect(cdnUrlFor("photos/abc/original.jpg")).toBe(
      "https://cdn.example.com/photos/abc/original.jpg",
    );
  });

  it("returns the key as-is when no CDN is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_URL", "");
    expect(cdnUrlFor("photos/abc/original.jpg")).toBe(
      "photos/abc/original.jpg",
    );
  });

  it("propagates null and undefined", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_URL", "https://cdn.example.com");
    expect(cdnUrlFor(null)).toBeNull();
    expect(cdnUrlFor(undefined)).toBeNull();
  });
});

describe("variantStorageKey", () => {
  it("matches the processing pipeline's storage layout", () => {
    expect(variantStorageKey("abc-123", "thumb_200")).toBe(
      "photos/abc-123/thumb_200.webp",
    );
    expect(variantStorageKey("abc-123", "web_1200")).toBe(
      "photos/abc-123/web_1200.webp",
    );
    expect(variantStorageKey("abc-123", "retina_2400")).toBe(
      "photos/abc-123/retina_2400.webp",
    );
  });
});
