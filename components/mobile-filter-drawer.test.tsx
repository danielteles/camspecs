import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CheckboxFilterSection } from "@/components/filter-sidebar";
import { MobileFilterDrawer } from "@/components/mobile-filter-drawer";

function brandSection(): CheckboxFilterSection {
  return {
    type: "checkbox",
    id: "brand",
    label: "Brand",
    options: [{ value: "sony", label: "Sony", count: 3 }],
    selected: [],
    onChange: vi.fn(),
  };
}

describe("MobileFilterDrawer", () => {
  it("shows the active filter count on the trigger button", () => {
    render(
      <MobileFilterDrawer
        sections={[brandSection()]}
        activeCount={2}
        open={false}
        onOpenChange={vi.fn()}
        triggerLabel="Filters"
        titleLabel="Filters"
        closeLabel="Close"
        clearAllLabel="Clear all"
        onClearAll={vi.fn()}
        applyLabel="Show results"
      />,
    );

    const trigger = screen.getByRole("button", { name: /Filters/ });
    expect(trigger).toHaveTextContent("2");
  });

  it("hides the count badge when there are no active filters", () => {
    render(
      <MobileFilterDrawer
        sections={[brandSection()]}
        activeCount={0}
        open={false}
        onOpenChange={vi.fn()}
        triggerLabel="Filters"
        titleLabel="Filters"
        closeLabel="Close"
        clearAllLabel="Clear all"
        onClearAll={vi.fn()}
        applyLabel="Show results"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Filters" }),
    ).not.toHaveTextContent(/\d/);
  });

  it("renders the filter sections and footer actions once open", () => {
    render(
      <MobileFilterDrawer
        sections={[brandSection()]}
        activeCount={1}
        open
        onOpenChange={vi.fn()}
        triggerLabel="Filters"
        titleLabel="Filters"
        closeLabel="Close"
        clearAllLabel="Clear all"
        onClearAll={vi.fn()}
        applyLabel="Show results"
      />,
    );

    expect(screen.getByRole("checkbox", { name: /Sony/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear all" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show results" }),
    ).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Apply is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <MobileFilterDrawer
        sections={[brandSection()]}
        activeCount={1}
        open
        onOpenChange={onOpenChange}
        triggerLabel="Filters"
        titleLabel="Filters"
        closeLabel="Close"
        clearAllLabel="Clear all"
        onClearAll={vi.fn()}
        applyLabel="Show results"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show results" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables Clear all when there are no active filters", () => {
    render(
      <MobileFilterDrawer
        sections={[brandSection()]}
        activeCount={0}
        open
        onOpenChange={vi.fn()}
        triggerLabel="Filters"
        titleLabel="Filters"
        closeLabel="Close"
        clearAllLabel="Clear all"
        onClearAll={vi.fn()}
        applyLabel="Show results"
      />,
    );

    expect(screen.getByRole("button", { name: "Clear all" })).toBeDisabled();
  });
});
