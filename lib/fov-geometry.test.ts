import { describe, expect, it } from "vitest";

import { computeFovWedge } from "./fov-geometry";

const OPTIONS = { width: 400, height: 260, arcRadius: 36 };

describe("computeFovWedge", () => {
  it("computes exact symmetric geometry for a 90 degree field of view", () => {
    // A 90deg FoV gives a 45deg half-angle, where sin(45) === cos(45), so
    // the edge/arc offsets are exactly equal on both axes - a clean,
    // independently-verifiable case.
    const geometry = computeFovWedge(90, OPTIONS);

    expect(geometry.apex).toEqual({ x: 200, y: 234 });
    expect(geometry.leftEdge).toEqual({ x: 52.92, y: 86.92 });
    expect(geometry.rightEdge).toEqual({ x: 347.08, y: 86.92 });
    expect(geometry.arcStart).toEqual({ x: 174.54, y: 208.54 });
    expect(geometry.arcEnd).toEqual({ x: 225.46, y: 208.54 });
  });

  it("is symmetric around the vertical center line for any angle", () => {
    const geometry = computeFovWedge(63.4, OPTIONS);
    const centerX = OPTIONS.width / 2;

    expect(geometry.leftEdge.x).toBeCloseTo(
      centerX - (geometry.rightEdge.x - centerX),
      9,
    );
    expect(geometry.leftEdge.y).toBe(geometry.rightEdge.y);
    expect(geometry.arcStart.x).toBeCloseTo(
      centerX - (geometry.arcEnd.x - centerX),
      9,
    );
    expect(geometry.arcStart.y).toBe(geometry.arcEnd.y);
  });

  it("widens the edge spread as the angle increases", () => {
    const narrow = computeFovWedge(20, OPTIONS);
    const wide = computeFovWedge(100, OPTIONS);

    const narrowSpread = narrow.rightEdge.x - narrow.leftEdge.x;
    const wideSpread = wide.rightEdge.x - wide.leftEdge.x;

    expect(wideSpread).toBeGreaterThan(narrowSpread);
  });

  it("produces well-formed SVG path strings", () => {
    const geometry = computeFovWedge(90, OPTIONS);

    expect(geometry.wedgePath).toBe("M 200 234 L 52.92 86.92 L 347.08 86.92 Z");
    expect(geometry.arcPath).toBe(
      "M 174.54 208.54 A 36 36 0 0 1 225.46 208.54",
    );
  });

  it.each([0, -10, 180, 181, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws a RangeError for an out-of-range fovDegrees (%s)",
    (fovDegrees) => {
      expect(() => computeFovWedge(fovDegrees, OPTIONS)).toThrow(RangeError);
    },
  );

  it.each([0, -1])(
    "throws a RangeError for a non-positive width (%s)",
    (width) => {
      expect(() => computeFovWedge(90, { ...OPTIONS, width })).toThrow(
        RangeError,
      );
    },
  );

  it.each([0, -1])(
    "throws a RangeError for a non-positive height (%s)",
    (height) => {
      expect(() => computeFovWedge(90, { ...OPTIONS, height })).toThrow(
        RangeError,
      );
    },
  );

  it.each([0, -1])(
    "throws a RangeError for a non-positive arcRadius (%s)",
    (arcRadius) => {
      expect(() => computeFovWedge(90, { ...OPTIONS, arcRadius })).toThrow(
        RangeError,
      );
    },
  );
});
