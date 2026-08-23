import { describe, expect, it } from "vitest";

import {
  FULL_FRAME_SENSOR,
  getCropFactor,
  getDiagonalFieldOfView,
  getEquivalentAperture,
  getEquivalentFocalLength,
  getFieldOfViewDegrees,
  getHorizontalFieldOfView,
  getSensorDiagonalMm,
  getVerticalFieldOfView,
} from "./equivalence";
import { CAMERAS } from "@/test/mocks/equipment";

const APS_C_SENSOR = { widthMm: 23.5, heightMm: 15.6 };
const MFT_SENSOR = { widthMm: 17.4, heightMm: 13.0 };

describe("getSensorDiagonalMm", () => {
  it("computes the diagonal via the Pythagorean theorem", () => {
    // 6-8-10 right triangle: exact, no floating point rounding involved.
    expect(getSensorDiagonalMm({ widthMm: 6, heightMm: 8 })).toBe(10);
  });

  it("computes the diagonal of a real 35mm full-frame sensor", () => {
    expect(getSensorDiagonalMm(FULL_FRAME_SENSOR)).toBeCloseTo(43.2666, 4);
  });

  it.each([
    { widthMm: 0, heightMm: 24 },
    { widthMm: 36, heightMm: 0 },
    { widthMm: -36, heightMm: 24 },
    { widthMm: 36, heightMm: -24 },
    { widthMm: Number.NaN, heightMm: 24 },
    { widthMm: Number.POSITIVE_INFINITY, heightMm: 24 },
  ])("throws a RangeError for non-positive dimensions %o", (sensor) => {
    expect(() => getSensorDiagonalMm(sensor)).toThrow(RangeError);
  });
});

describe("getCropFactor", () => {
  it("is exactly 1 when the sensor matches the reference sensor", () => {
    expect(getCropFactor(FULL_FRAME_SENSOR, FULL_FRAME_SENSOR)).toBe(1);
  });

  it("defaults the reference sensor to 35mm full-frame", () => {
    expect(getCropFactor(FULL_FRAME_SENSOR)).toBe(1);
  });

  it("computes an exact crop factor from a custom reference sensor", () => {
    // 30-40-50 triangle over a 6-8-10 triangle: crop factor is exactly 5.
    const reference = { widthMm: 30, heightMm: 40 };
    const sensor = { widthMm: 6, heightMm: 8 };
    expect(getCropFactor(sensor, reference)).toBe(5);
  });

  it("computes the real-world APS-C crop factor relative to full-frame", () => {
    expect(getCropFactor(APS_C_SENSOR)).toBeCloseTo(1.5339, 4);
  });

  it("computes the real-world Micro Four Thirds crop factor relative to full-frame", () => {
    expect(getCropFactor(MFT_SENSOR)).toBeCloseTo(1.992, 3);
  });
});

describe("getEquivalentFocalLength", () => {
  it("multiplies the focal length by the crop factor", () => {
    expect(getEquivalentFocalLength(50, 1.5)).toBe(75);
  });

  it("returns the same focal length for a crop factor of 1", () => {
    expect(getEquivalentFocalLength(35, 1)).toBe(35);
  });

  it.each([0, -50, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws a RangeError for a non-positive focal length (%s)",
    (focalLengthMm) => {
      expect(() => getEquivalentFocalLength(focalLengthMm, 1.5)).toThrow(
        RangeError,
      );
    },
  );

  it.each([0, -1.5])(
    "throws a RangeError for a non-positive crop factor (%s)",
    (cropFactor) => {
      expect(() => getEquivalentFocalLength(50, cropFactor)).toThrow(
        RangeError,
      );
    },
  );
});

describe("getEquivalentAperture", () => {
  it("multiplies the aperture by the crop factor", () => {
    expect(getEquivalentAperture(1.8, 1.5)).toBeCloseTo(2.7, 10);
  });

  it("returns the same aperture for a crop factor of 1", () => {
    expect(getEquivalentAperture(2.8, 1)).toBe(2.8);
  });

  it.each([0, -1.8])(
    "throws a RangeError for a non-positive aperture (%s)",
    (aperture) => {
      expect(() => getEquivalentAperture(aperture, 1.5)).toThrow(RangeError);
    },
  );

  it.each([0, -1.5])(
    "throws a RangeError for a non-positive crop factor (%s)",
    (cropFactor) => {
      expect(() => getEquivalentAperture(1.8, cropFactor)).toThrow(RangeError);
    },
  );
});

describe("getFieldOfViewDegrees", () => {
  it("returns exactly 90 degrees when the sensor dimension equals twice the focal length", () => {
    // tan(45deg) === 1, so a 18mm lens over a 36mm dimension yields a
    // mathematically exact 90 degree angle of view.
    expect(getFieldOfViewDegrees(18, 36)).toBe(90);
  });

  it("computes the real-world horizontal field of view for a 50mm lens on full-frame", () => {
    expect(getFieldOfViewDegrees(50, FULL_FRAME_SENSOR.widthMm)).toBeCloseTo(
      39.5978,
      4,
    );
  });

  it("narrows as the focal length increases", () => {
    const wide = getFieldOfViewDegrees(24, FULL_FRAME_SENSOR.widthMm);
    const tele = getFieldOfViewDegrees(200, FULL_FRAME_SENSOR.widthMm);
    expect(tele).toBeLessThan(wide);
  });

  it.each([0, -50])(
    "throws a RangeError for a non-positive focal length (%s)",
    (focalLengthMm) => {
      expect(() => getFieldOfViewDegrees(focalLengthMm, 36)).toThrow(
        RangeError,
      );
    },
  );

  it.each([0, -36])(
    "throws a RangeError for a non-positive sensor dimension (%s)",
    (sensorDimensionMm) => {
      expect(() => getFieldOfViewDegrees(50, sensorDimensionMm)).toThrow(
        RangeError,
      );
    },
  );
});

describe("getHorizontalFieldOfView", () => {
  it("uses the sensor width", () => {
    expect(getHorizontalFieldOfView(50, FULL_FRAME_SENSOR)).toBeCloseTo(
      39.5978,
      4,
    );
  });
});

describe("getVerticalFieldOfView", () => {
  it("uses the sensor height", () => {
    expect(getVerticalFieldOfView(50, FULL_FRAME_SENSOR)).toBeCloseTo(
      26.9915,
      4,
    );
  });

  it("is narrower than the horizontal field of view for a landscape sensor", () => {
    const horizontal = getHorizontalFieldOfView(50, FULL_FRAME_SENSOR);
    const vertical = getVerticalFieldOfView(50, FULL_FRAME_SENSOR);
    expect(vertical).toBeLessThan(horizontal);
  });
});

describe("getDiagonalFieldOfView", () => {
  it("uses the sensor diagonal", () => {
    expect(getDiagonalFieldOfView(50, FULL_FRAME_SENSOR)).toBeCloseTo(
      46.793,
      3,
    );
  });

  it("is wider than both the horizontal and vertical field of view", () => {
    const horizontal = getHorizontalFieldOfView(50, FULL_FRAME_SENSOR);
    const vertical = getVerticalFieldOfView(50, FULL_FRAME_SENSOR);
    const diagonal = getDiagonalFieldOfView(50, FULL_FRAME_SENSOR);
    expect(diagonal).toBeGreaterThan(horizontal);
    expect(diagonal).toBeGreaterThan(vertical);
  });
});

describe("mock data integrity", () => {
  it("derives a crop factor close to 1 for full-frame cameras", () => {
    const fullFrameCamera = CAMERAS.find(
      (camera) => camera.sensorFormat === "full-frame",
    );
    expect(fullFrameCamera).toBeDefined();
    // Real "full-frame" sensors (e.g. 35.6mm x 23.8mm) are marketed as 1.0x
    // but their active area is slightly smaller than the 36mm x 24mm
    // reference, so the derived crop factor is close to, not exactly, 1.
    expect(getCropFactor(fullFrameCamera!.sensor)).toBeCloseTo(1, 1);
  });

  it("derives an increasing crop factor as sensors get smaller", () => {
    const fullFrame = CAMERAS.find((c) => c.sensorFormat === "full-frame")!;
    const apsC = CAMERAS.find((c) => c.sensorFormat === "aps-c")!;
    const mft = CAMERAS.find((c) => c.sensorFormat === "micro-four-thirds")!;

    const fullFrameCrop = getCropFactor(fullFrame.sensor);
    const apsCCrop = getCropFactor(apsC.sensor);
    const mftCrop = getCropFactor(mft.sensor);

    expect(fullFrameCrop).toBeLessThan(apsCCrop);
    expect(apsCCrop).toBeLessThan(mftCrop);
  });
});
