export interface Point {
  x: number;
  y: number;
}

export interface FovWedgeOptions {
  /** SVG viewBox width. */
  width: number;
  /** SVG viewBox height. */
  height: number;
  /** Radius of the small angle-indicator arc drawn near the apex. */
  arcRadius: number;
}

export interface FovWedgeGeometry {
  apex: Point;
  leftEdge: Point;
  rightEdge: Point;
  arcStart: Point;
  arcEnd: Point;
  /** `<path>` d attribute for the filled wedge (apex to both edges). */
  wedgePath: string;
  /** `<path>` d attribute for the small angle-indicator arc. */
  arcPath: string;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function point(x: number, y: number): Point {
  return { x: round(x), y: round(y) };
}

/**
 * Computes the SVG geometry for a top-down "field of view" wedge: an apex
 * (the camera position) at the bottom-center of the viewBox, with two edges
 * spreading upward at ±(fovDegrees / 2) from vertical.
 */
export function computeFovWedge(
  fovDegrees: number,
  { width, height, arcRadius }: FovWedgeOptions,
): FovWedgeGeometry {
  if (!Number.isFinite(fovDegrees) || fovDegrees <= 0 || fovDegrees >= 180) {
    throw new RangeError(
      "fovDegrees must be a finite number between 0 and 180, exclusive.",
    );
  }
  if (!Number.isFinite(width) || width <= 0) {
    throw new RangeError("width must be a positive, finite number.");
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new RangeError("height must be a positive, finite number.");
  }
  if (!Number.isFinite(arcRadius) || arcRadius <= 0) {
    throw new RangeError("arcRadius must be a positive, finite number.");
  }

  const apexMargin = height * 0.1;
  const edgeLength = height - apexMargin * 2;
  const halfAngleRad = (fovDegrees / 2) * (Math.PI / 180);

  const apex = point(width / 2, height - apexMargin);
  const dx = edgeLength * Math.sin(halfAngleRad);
  const dy = edgeLength * Math.cos(halfAngleRad);
  const leftEdge = point(apex.x - dx, apex.y - dy);
  const rightEdge = point(apex.x + dx, apex.y - dy);

  const arcDx = arcRadius * Math.sin(halfAngleRad);
  const arcDy = arcRadius * Math.cos(halfAngleRad);
  const arcStart = point(apex.x - arcDx, apex.y - arcDy);
  const arcEnd = point(apex.x + arcDx, apex.y - arcDy);

  const wedgePath = `M ${apex.x} ${apex.y} L ${leftEdge.x} ${leftEdge.y} L ${rightEdge.x} ${rightEdge.y} Z`;
  const arcPath = `M ${arcStart.x} ${arcStart.y} A ${arcRadius} ${arcRadius} 0 0 1 ${arcEnd.x} ${arcEnd.y}`;

  return { apex, leftEdge, rightEdge, arcStart, arcEnd, wedgePath, arcPath };
}
