import { computeFovWedge } from "@/lib/fov-geometry";

const WIDTH = 400;
const HEIGHT = 260;
const ARC_RADIUS = 36;

export function FieldOfViewDiagram({ fovDegrees }: { fovDegrees: number }) {
  const { apex, leftEdge, rightEdge, wedgePath, arcPath } = computeFovWedge(
    fovDegrees,
    { width: WIDTH, height: HEIGHT, arcRadius: ARC_RADIUS },
  );

  const labelY = apex.y - ARC_RADIUS - 10;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-hidden="true"
      className="w-full max-w-md"
    >
      <line
        x1={apex.x}
        y1={apex.y}
        x2={apex.x}
        y2={0}
        className="stroke-border"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <path
        d={wedgePath}
        className="fill-primary/10 stroke-primary"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d={arcPath}
        className="stroke-primary fill-none"
        strokeWidth={1.5}
      />
      <text
        x={apex.x}
        y={labelY}
        textAnchor="middle"
        className="fill-foreground text-sm font-medium"
      >
        {fovDegrees.toFixed(1)}°
      </text>
      <circle cx={apex.x} cy={apex.y} r={4} className="fill-primary" />
      <line
        x1={leftEdge.x}
        y1={leftEdge.y}
        x2={rightEdge.x}
        y2={rightEdge.y}
        className="stroke-border"
        strokeWidth={1}
      />
    </svg>
  );
}
