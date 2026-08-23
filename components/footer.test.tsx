import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Footer } from "@/components/footer";
import { getAllCameras } from "@/lib/services/equipment";
import type { Camera } from "@/lib/types";

// Footer.tsx hardcodes real production slugs (see its POPULAR_COMPARISON_SLUGS
// comment) that don't overlap with the shared test/mocks/equipment.ts
// fixtures other tests rely on — so this test supplies its own camera pair
// matching one of the footer's actual configured slugs, rather than
// reaching for fixture slugs the footer no longer references.
const SONY_A7_IV: Camera = {
  slug: "sony-alpha-7-iv",
  brand: "Sony",
  model: "Alpha 7 IV",
  mount: "sony-e",
  sensorFormat: "full-frame",
  sensor: { widthMm: 35.6, heightMm: 23.8 },
  megapixels: 33,
  releaseYear: 2021,
  updatedAt: new Date("2026-08-20T12:00:00Z"),
};
const CANON_R6_II: Camera = {
  slug: "canon-eos-r6-mark-ii",
  brand: "Canon",
  model: "EOS R6 Mark II",
  mount: "canon-rf",
  sensorFormat: "full-frame",
  sensor: { widthMm: 36.0, heightMm: 24.0 },
  megapixels: 24.2,
  releaseYear: 2022,
  updatedAt: new Date("2026-08-20T12:00:00Z"),
};

describe("Footer", () => {
  it("renders localized catalog links", async () => {
    render(await Footer());

    expect(screen.getByRole("link", { name: "Cameras" })).toHaveAttribute(
      "href",
      "/cameras",
    );
    expect(screen.getByRole("link", { name: "Lenses" })).toHaveAttribute(
      "href",
      "/lenses",
    );
  });

  it("renders popular comparison links with resolved product names", async () => {
    vi.mocked(getAllCameras).mockResolvedValueOnce([SONY_A7_IV, CANON_R6_II]);

    render(await Footer());

    const link = screen.getByRole("link", {
      name: "Sony Alpha 7 IV vs Canon EOS R6 Mark II",
    });
    expect(link).toHaveAttribute(
      "href",
      "/compare?items=sony-alpha-7-iv,canon-eos-r6-mark-ii",
    );
  });

  it("links to the GitHub repository in a new tab", async () => {
    render(await Footer());

    const link = screen.getByRole("link", { name: /GitHub repository/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/danielteles/camspecs",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("includes the language switcher", async () => {
    render(await Footer());

    expect(screen.getByRole("link", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Português" })).toBeInTheDocument();
  });
});
