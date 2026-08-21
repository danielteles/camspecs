/**
 * Renders the JSX tree for OpenGraph images via `next/og`'s ImageResponse.
 * This is NOT a regular React component: it runs through Satori (no CSS
 * cascade, no Tailwind classes), so every element needs an explicit
 * `display` and styles are plain inline objects.
 */
export function OgCard({
  eyebrow,
  title,
  subtitle,
  specs,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  specs: Array<{ label: string; value: string }>;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 64,
        backgroundColor: "#0a0a0a",
        color: "#fafafa",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 28,
          color: "#a3a3a3",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#d4d4d4" }}>
          {subtitle}
        </div>
      </div>
      <div style={{ display: "flex", gap: 48 }}>
        {specs.map((spec) => (
          <div
            key={spec.label}
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
          >
            <div style={{ display: "flex", fontSize: 20, color: "#a3a3a3" }}>
              {spec.label}
            </div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>
              {spec.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
