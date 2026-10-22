import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driveLegacyThumbnailUrl, driveThumbnailUrl, driveViewUrl, extractDriveFileId } from "@/lib/drive";

const VIEW_URL = "https://drive.google.com/file/d/1iNwpamXbNtKnpg6ewRIvrDZNtRLBT_0q/view";
const ID = "1iNwpamXbNtKnpg6ewRIvrDZNtRLBT_0q";

describe("extractDriveFileId", () => {
  it("extracts the id from a /file/d/{id}/view link", () => {
    expect(extractDriveFileId(VIEW_URL)).toBe(ID);
  });

  it("extracts the id from an ?id= style link", () => {
    expect(extractDriveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
  });

  it("returns null for a non-Drive URL", () => {
    expect(extractDriveFileId("https://example.com/not-drive")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractDriveFileId("")).toBeNull();
  });
});

describe("driveThumbnailUrl", () => {
  it("builds a direct googleusercontent URL with the extracted id", () => {
    expect(driveThumbnailUrl(VIEW_URL)).toBe(`https://lh3.googleusercontent.com/d/${ID}=w1000`);
    expect(driveThumbnailUrl(VIEW_URL, 1600)).toBe(`https://lh3.googleusercontent.com/d/${ID}=w1600`);
  });

  it("keeps the legacy Drive endpoint available as a fallback", () => {
    expect(driveLegacyThumbnailUrl(VIEW_URL)).toBe(`https://drive.google.com/thumbnail?id=${ID}&sz=w1000`);
  });

  it("returns null when no id can be extracted", () => {
    expect(driveThumbnailUrl("not a drive link")).toBeNull();
  });
});

describe("driveViewUrl", () => {
  it("normalizes to a canonical view URL", () => {
    expect(driveViewUrl(`https://drive.google.com/open?id=${ID}`)).toBe(
      `https://drive.google.com/file/d/${ID}/view`,
    );
  });

  it("falls back to the original string when no id is found", () => {
    expect(driveViewUrl("https://example.com/x")).toBe("https://example.com/x");
  });
});

describe("fetchDriveFileName", () => {
  // Fresh module per test so the API key stub and an empty cache take effect.
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks Drive once per file id, then answers from the cache", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ name: "Velocity_X_0.30.png" })));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchDriveFileName } = await import("@/lib/drive");

    expect(await fetchDriveFileName(VIEW_URL)).toBe("Velocity_X_0.30.png");
    // Same file through a different link shape.
    expect(await fetchDriveFileName(`https://drive.google.com/open?id=${ID}`)).toBe("Velocity_X_0.30.png");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed lookup", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchDriveFileName } = await import("@/lib/drive");

    expect(await fetchDriveFileName(VIEW_URL)).toBeNull();
    expect(await fetchDriveFileName(VIEW_URL)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
