import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPhotoUpload, type UploadState } from "@/lib/upload-client";

class FakeXHR {
  static instances: FakeXHR[] = [];

  upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 200;
  statusText = "OK";
  timeout = 0;
  method?: string;
  url?: string;
  headers: Record<string, string> = {};

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }
  send(_body: unknown) {
    FakeXHR.instances.push(this);
  }
  abort() {
    this.onabort?.();
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const PRESIGN_DATA = {
  url: "https://r2.example/put",
  storageKey: "photos/p1/original.jpg",
  photoId: "p1",
};

function stubFetch(opts?: {
  confirmFails?: boolean;
  readyAfterPolls?: number;
}) {
  let polls = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/uploads/presign")) {
      return jsonResponse({ data: PRESIGN_DATA, error: null });
    }
    if (url === "/api/uploads/confirm") {
      if (opts?.confirmFails) {
        return jsonResponse(
          { data: null, error: "File not found in storage" },
          400,
        );
      }
      return jsonResponse({ data: { id: "p1", status: "processing" }, error: null });
    }
    if (url === "/api/photos/p1") {
      polls++;
      const status =
        polls >= (opts?.readyAfterPolls ?? 1) ? "ready" : "processing";
      return jsonResponse({ data: { status }, error: null });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("startPhotoUpload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeXHR.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    vi.stubEnv("NEXT_PUBLIC_CDN_URL", "https://cdn.example.com");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("walks presign → upload → confirm → poll → ready", async () => {
    stubFetch({ readyAfterPolls: 2 });
    const file = new File(["data"], "shot.jpg", { type: "image/jpeg" });
    const states: UploadState[] = [];

    const handle = startPhotoUpload(file, {
      onChange: (s) => states.push(s),
    });

    await vi.advanceTimersByTimeAsync(0); // presign resolves, PUT starts
    const req = FakeXHR.instances[0];
    expect(req.method).toBe("PUT");
    expect(req.url).toBe(PRESIGN_DATA.url);
    expect(req.headers["Content-Type"]).toBe("image/jpeg");

    req.upload.onprogress?.({
      lengthComputable: true,
      loaded: 5,
      total: 10,
    } as ProgressEvent);
    req.onload?.();
    await vi.advanceTimersByTimeAsync(0); // confirm resolves

    // Upload hand-off happens when polling starts, not when it finishes.
    await expect(handle.uploaded).resolves.toBeUndefined();

    await vi.advanceTimersByTimeAsync(2000); // poll 1 → still processing
    await vi.advanceTimersByTimeAsync(2000); // poll 2 → ready
    await handle.done;

    expect(states.map((s) => s.status)).toEqual([
      "presigning",
      "uploading",
      "uploading", // progress event
      "confirming",
      "processing",
      "ready",
    ]);
    expect(states[2].progress).toBe(50);
    expect(states.at(-1)).toMatchObject({
      status: "ready",
      photoId: "p1",
      thumbUrl: "https://cdn.example.com/photos/p1/thumb_200.webp",
    });
  });

  it("fails with the server message when confirm is rejected", async () => {
    stubFetch({ confirmFails: true });
    const file = new File(["data"], "shot.jpg", { type: "image/jpeg" });
    const states: UploadState[] = [];

    const handle = startPhotoUpload(file, {
      onChange: (s) => states.push(s),
    });

    await vi.advanceTimersByTimeAsync(0);
    FakeXHR.instances[0].onload?.();
    await vi.advanceTimersByTimeAsync(0);
    await handle.done;

    expect(states.at(-1)).toMatchObject({
      status: "failed",
      error: "Confirm failed: File not found in storage",
    });
  });

  it("emits nothing further after cancel mid-upload", async () => {
    stubFetch();
    const file = new File(["data"], "shot.jpg", { type: "image/jpeg" });
    const states: UploadState[] = [];

    const handle = startPhotoUpload(file, {
      onChange: (s) => states.push(s),
    });

    await vi.advanceTimersByTimeAsync(0); // PUT in flight
    handle.cancel(); // aborts the XHR
    await handle.done;
    await expect(handle.uploaded).resolves.toBeUndefined();

    expect(states.at(-1)?.status).toBe("uploading");
    expect(states.some((s) => s.status === "failed")).toBe(false);
  });
});
