import { describe, expect, it } from "vitest";
import { getImageUrl, getImageSrcSet } from "@/utils/imageHelpers";

const photoView = {
  id: "p1",
  url: "https://cdn/photos/p1/original.jpg",
  width: 6000,
  _thumbUrl: "https://cdn/photos/p1/thumb_200.webp",
  _displayUrl: "https://cdn/photos/p1/web_1200.webp",
  _retinaUrl: "https://cdn/photos/p1/retina_2400.webp",
};

describe("getImageSrcSet (PhotoView shape)", () => {
  it("offers thumb, web, retina, and the original at its true width", () => {
    expect(getImageSrcSet(photoView)).toBe(
      [
        "https://cdn/photos/p1/thumb_200.webp 200w",
        "https://cdn/photos/p1/web_1200.webp 1200w",
        "https://cdn/photos/p1/retina_2400.webp 2400w",
        "https://cdn/photos/p1/original.jpg 6000w",
      ].join(", "),
    );
  });

  it("omits the original when it is not larger than the retina variant", () => {
    expect(getImageSrcSet({ ...photoView, width: 2200 })).not.toContain(
      "original.jpg",
    );
  });

  it("omits the original when the true width is unknown", () => {
    expect(getImageSrcSet({ ...photoView, width: null })).not.toContain(
      "original.jpg",
    );
  });

  it("skips missing variants", () => {
    expect(getImageSrcSet({ ...photoView, _retinaUrl: null, width: null }))
      .toBe(
        [
          "https://cdn/photos/p1/thumb_200.webp 200w",
          "https://cdn/photos/p1/web_1200.webp 1200w",
        ].join(", "),
      );
  });
});

describe("getImageUrl (PhotoView shape)", () => {
  it("maps sizes to variant URLs with the original as 'full'", () => {
    expect(getImageUrl(photoView, "thumbnail")).toBe(photoView._thumbUrl);
    expect(getImageUrl(photoView, "display")).toBe(photoView._displayUrl);
    expect(getImageUrl(photoView, "full")).toBe(photoView.url);
  });
});
