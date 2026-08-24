import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActiveFilterBadges } from "@/components/active-filter-badges";

describe("ActiveFilterBadges", () => {
  it("renders nothing when there are no active filters", () => {
    const { container } = render(
      <ActiveFilterBadges
        chips={[]}
        onClearAll={vi.fn()}
        clearAllLabel="Clear all"
        removeLabel={(label) => `Remove ${label} filter`}
        groupLabel="Active filters"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a badge per active filter", () => {
    render(
      <ActiveFilterBadges
        chips={[
          { id: "brand-sony", label: "Sony", onRemove: vi.fn() },
          { id: "mount-sony-e", label: "Sony E", onRemove: vi.fn() },
        ]}
        onClearAll={vi.fn()}
        clearAllLabel="Clear all"
        removeLabel={(label) => `Remove ${label} filter`}
        groupLabel="Active filters"
      />,
    );

    expect(screen.getByText("Sony")).toBeInTheDocument();
    expect(screen.getByText("Sony E")).toBeInTheDocument();
  });

  it("calls the chip's onRemove when its remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <ActiveFilterBadges
        chips={[{ id: "brand-sony", label: "Sony", onRemove }]}
        onClearAll={vi.fn()}
        clearAllLabel="Clear all"
        removeLabel={(label) => `Remove ${label} filter`}
        groupLabel="Active filters"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Remove Sony filter" }),
    );

    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("calls onClearAll when the clear-all button is clicked", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    render(
      <ActiveFilterBadges
        chips={[{ id: "brand-sony", label: "Sony", onRemove: vi.fn() }]}
        onClearAll={onClearAll}
        clearAllLabel="Clear all"
        removeLabel={(label) => `Remove ${label} filter`}
        groupLabel="Active filters"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onClearAll).toHaveBeenCalledOnce();
  });
});
