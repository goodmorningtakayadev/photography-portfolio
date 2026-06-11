import { describe, expect, it } from "vitest";
import { slugify, CATEGORY_SLUG_MAX, PROJECT_SLUG_MAX } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World", 200)).toBe("hello-world");
    expect(slugify("LA Session", 200)).toBe("la-session");
  });

  it("collapses runs of non-alphanumerics into one hyphen", () => {
    expect(slugify("a  --  b", 200)).toBe("a-b");
    expect(slugify("street & travel", 200)).toBe("street-travel");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--portraits--", 200)).toBe("portraits");
    expect(slugify("  (night)  ", 200)).toBe("night");
  });

  it("returns null when nothing survives", () => {
    expect(slugify("", 200)).toBeNull();
    expect(slugify("   ", 200)).toBeNull();
    expect(slugify("!!!---***", 200)).toBeNull();
  });

  it("truncates to maxLength", () => {
    expect(slugify("a".repeat(300), 100)).toBe("a".repeat(100));
    expect(slugify("a".repeat(300), 200)).toBe("a".repeat(200));
  });

  it("exposes the schema-derived length constants", () => {
    expect(CATEGORY_SLUG_MAX).toBe(100);
    expect(PROJECT_SLUG_MAX).toBe(200);
  });
});
