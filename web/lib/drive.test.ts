import { describe, expect, it } from "vitest";
import { driveThumbnailUrl, driveViewUrl, extractDriveFileId } from "@/lib/drive";

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
  it("builds a thumbnail endpoint URL with the extracted id", () => {
    expect(driveThumbnailUrl(VIEW_URL)).toBe(`https://drive.google.com/thumbnail?id=${ID}&sz=w1000`);
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
