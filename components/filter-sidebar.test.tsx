import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  CheckboxFilterSection,
  RangeFilterSection,
} from "@/components/filter-sidebar";
import { FilterSidebar } from "@/components/filter-sidebar";

function brandSection(
  overrides: Partial<CheckboxFilterSection> = {},
): CheckboxFilterSection {
  return {
    type: "checkbox",
    id: "brand",
    label: "Brand",
    options: [
      { value: "sony", label: "Sony", count: 3 },
      { value: "fujifilm", label: "Fujifilm", count: 1 },
      { value: "canon", label: "Canon", count: 0 },
    ],
    selected: [],
    onChange: vi.fn(),
    ...overrides,
  };
}

function resolutionSection(
  overrides: Partial<RangeFilterSection> = {},
): RangeFilterSection {
  return {
    type: "range",
    id: "resolution",
    label: "Minimum resolution",
    min: 12,
    max: 60,
    step: 1,
    value: [24],
    onChange: vi.fn(),
    formatValue: (value) => `${value} MP`,
    ...overrides,
  };
}

/**
 * Radix's Slider computes the dragged value from the pointer position and
 * the track's rect (getValueFromPointer), which jsdom reports as all zeros
 * by default — so drag tests need a real width/left to compute against.
 */
function mockSliderRect(
  element: HTMLElement,
  { left = 0, width = 200 }: { left?: number; width?: number } = {},
) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left,
    right: left + width,
    width,
    top: 0,
    bottom: 20,
    height: 20,
    x: left,
    y: 0,
    toJSON: () => {},
  });
}

function getSliderRoot() {
  return document.querySelector('[data-slot="slider"]') as HTMLElement;
}

describe("FilterSidebar", () => {
  it("renders every section as an accordion trigger", () => {
    render(<FilterSidebar sections={[brandSection(), resolutionSection()]} />);

    expect(screen.getByRole("button", { name: "Brand" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Minimum resolution" }),
    ).toBeInTheDocument();
  });

  it("renders each checkbox option with its label and count", () => {
    render(<FilterSidebar sections={[brandSection()]} />);

    expect(screen.getByRole("checkbox", { name: /Sony/ })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Fujifilm/ }),
    ).toBeInTheDocument();
  });

  it("calls onChange with the value added when an unchecked option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterSidebar
        sections={[brandSection({ selected: ["sony"], onChange })]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /Fujifilm/ }));

    expect(onChange).toHaveBeenCalledWith(["sony", "fujifilm"]);
  });

  it("calls onChange with the value removed when a checked option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterSidebar
        sections={[brandSection({ selected: ["sony", "fujifilm"], onChange })]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /Sony/ }));

    expect(onChange).toHaveBeenCalledWith(["fujifilm"]);
  });

  it("disables a zero-count option that isn't selected", () => {
    render(<FilterSidebar sections={[brandSection()]} />);

    expect(screen.getByRole("checkbox", { name: /Canon/ })).toBeDisabled();
  });

  it("keeps a zero-count option enabled if it's already selected", () => {
    render(
      <FilterSidebar sections={[brandSection({ selected: ["canon"] })]} />,
    );

    expect(screen.getByRole("checkbox", { name: /Canon/ })).toBeEnabled();
  });

  it("renders a range section's current value and slider bounds", () => {
    render(<FilterSidebar sections={[resolutionSection()]} />);

    expect(screen.getByText("24 MP")).toBeInTheDocument();
    expect(screen.getByText("12 MP")).toBeInTheDocument();
    expect(screen.getByText("60 MP")).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Minimum resolution" }),
    ).toBeInTheDocument();
  });

  it("labels each thumb of a two-sided range independently", () => {
    render(
      <FilterSidebar
        sections={[
          resolutionSection({
            id: "focal-length",
            label: "Focal length",
            value: [24, 70],
            thumbLabels: ["Minimum focal length", "Maximum focal length"],
            formatValue: (value) => `${value}mm`,
          }),
        ]}
      />,
    );

    expect(screen.getByText("24mm – 70mm")).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Minimum focal length" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Maximum focal length" }),
    ).toBeInTheDocument();
  });

  it("updates the displayed value and thumb position live while dragging, before pointer up", () => {
    const onChange = vi.fn();
    render(
      <FilterSidebar
        sections={[
          resolutionSection({ min: 0, max: 100, value: [0], onChange }),
        ]}
      />,
    );

    const root = getSliderRoot();
    mockSliderRect(root, { left: 0, width: 200 });

    fireEvent.pointerDown(root, { pointerId: 1, button: 0, clientX: 0 });
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 100 });

    // Live during the move — before pointer up — and not yet committed to
    // the caller (that only happens once the drag ends).
    expect(screen.getByText("50 MP")).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Minimum resolution" }),
    ).toHaveAttribute("aria-valuenow", "50");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(root, { pointerId: 1, clientX: 100 });

    expect(onChange).toHaveBeenCalledExactlyOnceWith([50]);
  });

  it("keeps tracking every subsequent pointer move within the same drag", () => {
    const onChange = vi.fn();
    render(
      <FilterSidebar
        sections={[
          resolutionSection({ min: 0, max: 100, value: [0], onChange }),
        ]}
      />,
    );

    const root = getSliderRoot();
    mockSliderRect(root, { left: 0, width: 200 });

    fireEvent.pointerDown(root, { pointerId: 1, button: 0, clientX: 0 });

    fireEvent.pointerMove(root, { pointerId: 1, clientX: 40 });
    expect(screen.getByText("20 MP")).toBeInTheDocument();

    fireEvent.pointerMove(root, { pointerId: 1, clientX: 160 });
    expect(screen.getByText("80 MP")).toBeInTheDocument();

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(root, { pointerId: 1, clientX: 160 });
    expect(onChange).toHaveBeenCalledExactlyOnceWith([80]);
  });

  it("doesn't interrupt an in-progress drag when the parent re-renders with an equal-but-new value array", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterSidebar
        sections={[
          resolutionSection({ min: 0, max: 100, value: [0], onChange }),
        ]}
      />,
    );

    const root = getSliderRoot();
    mockSliderRect(root, { left: 0, width: 200 });

    fireEvent.pointerDown(root, { pointerId: 1, button: 0, clientX: 0 });
    fireEvent.pointerMove(root, { pointerId: 1, clientX: 100 });
    expect(screen.getByText("50 MP")).toBeInTheDocument();

    // Simulates an unrelated parent re-render that rebuilds a fresh `value`
    // array literal with the same numbers (e.g. cameras-catalog.tsx's
    // `sections` memo recomputing after a sibling filter commits) — a new
    // reference, but nothing this slider's value actually changed.
    rerender(
      <FilterSidebar
        sections={[
          resolutionSection({ min: 0, max: 100, value: [0], onChange }),
        ]}
      />,
    );

    expect(screen.getByText("50 MP")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("prefixes checkbox ids so two instances can render at once without collisions", () => {
    render(<FilterSidebar sections={[brandSection()]} idPrefix="mobile-" />);

    expect(screen.getByRole("checkbox", { name: /Sony/ })).toHaveAttribute(
      "id",
      "mobile-brand-sony",
    );
  });
});
