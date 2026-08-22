import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LastUpdatedBadge } from "@/components/last-updated-badge";

describe("LastUpdatedBadge", () => {
  it("renders the single-item label with a formatted date", async () => {
    render(await LastUpdatedBadge({ date: new Date("2026-08-20T12:00:00Z") }));

    expect(screen.getByText("Last updated: Aug 20, 2026")).toBeInTheDocument();
  });

  it("renders the aggregate label when comparing multiple items", async () => {
    render(
      await LastUpdatedBadge({
        date: new Date("2026-08-10T11:20:00Z"),
        variant: "aggregate",
      }),
    );

    expect(
      screen.getByText("Specs last synced: Aug 10, 2026"),
    ).toBeInTheDocument();
  });
});
