import { describe, expect, it } from "vitest";
import { parseVelocitySlice, slicePositions, velocitySlices } from "@/lib/slices";

describe("parseVelocitySlice", () => {
  it("reads a non-negative position after an underscore", () => {
    expect(parseVelocitySlice("Velocity_X_0.30.png")).toEqual({ axis: "X", position: 0.3 });
  });

  it("reads a negative position directly after the axis", () => {
    expect(parseVelocitySlice("Velocity_X-0.90.png")).toEqual({ axis: "X", position: -0.9 });
    expect(parseVelocitySlice("Velocity_Y-0.35.png")).toEqual({ axis: "Y", position: -0.35 });
  });

  it("reads the older bare-axis names", () => {
    expect(parseVelocitySlice("x__1.5.png")).toEqual({ axis: "X", position: 1.5 });
    expect(parseVelocitySlice("x_0.0.png")).toEqual({ axis: "X", position: 0 });
    expect(parseVelocitySlice("y__0.png")).toEqual({ axis: "Y", position: 0 });
    expect(parseVelocitySlice("y__0.55.png")).toEqual({ axis: "Y", position: 0.55 });
    expect(parseVelocitySlice("y_-0.55.png")).toEqual({ axis: "Y", position: -0.55 });
  });

  it("puts both naming schemes on the same positions", () => {
    expect(parseVelocitySlice("x__0.3.png")?.position).toBe(parseVelocitySlice("Velocity_X_0.30.png")?.position);
    expect(parseVelocitySlice("y_-0.1.png")?.position).toBe(parseVelocitySlice("Velocity_Y-0.10.png")?.position);
  });

  it("ignores non-slice images", () => {
    for (const name of [
      "Velocity_sweep.png",
      "CP_Top.png",
      "CP_Top_copy.png",
      "WSS_Left.png",
      "Wall_Y_.png",
      "CoT_sweep.png",
      "CpT_Sweep.png",
      "CpT_X_0.00.png",
      "Vector_Scene_1.png",
      "Mesh.png",
      "Geometry.png",
      "force_reports.txt",
    ]) {
      expect(parseVelocitySlice(name)).toBeNull();
    }
  });
});

describe("velocitySlices", () => {
  it("keeps only resolved slice names, sorted by axis then position", () => {
    const names = {
      a: "Velocity_X_1.00.png",
      b: "Velocity_Y-0.10.png",
      c: "Velocity_X-0.90.png",
      d: "CP_Top.png",
      e: null,
    };
    const slices = velocitySlices(["a", "b", "c", "d", "e"], names);
    expect(slices.map((s) => s.url)).toEqual(["c", "a", "b"]);
  });
});

describe("slicePositions", () => {
  it("merges and sorts one axis's positions across sims", () => {
    const sim1 = velocitySlices(["a", "b"], { a: "Velocity_X_0.50.png", b: "Velocity_Y-0.10.png" });
    const sim2 = velocitySlices(["c", "d"], { c: "Velocity_X_0.50.png", d: "Velocity_X-0.90.png" });
    expect(slicePositions([sim1, sim2], "X")).toEqual([-0.9, 0.5]);
  });
});
