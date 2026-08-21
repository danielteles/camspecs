import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatalogItemCard } from "@/components/catalog-item-card";

const baseProps = {
  href: "/cameras/sony-a7-iv",
  compareHref: "/compare?items=sony-a7-iv",
  eyebrow: "Sony E",
  title: "Sony Alpha 7 IV",
  meta: "33 MP · 2021",
  viewSpecsLabel: "View specs",
  addToCompareLabel: "Add to compare",
};

describe("CatalogItemCard", () => {
  it("renders the title, eyebrow, and meta text", () => {
    render(<CatalogItemCard {...baseProps} />);

    expect(
      screen.getByRole("heading", { name: "Sony Alpha 7 IV" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sony E")).toBeInTheDocument();
    expect(screen.getByText("33 MP · 2021")).toBeInTheDocument();
  });

  it("exposes the full eyebrow text via a title attribute for when it's truncated", () => {
    const longEyebrow = "Micro Four Thirds";
    render(<CatalogItemCard {...baseProps} eyebrow={longEyebrow} />);

    expect(screen.getByText(longEyebrow)).toHaveAttribute("title", longEyebrow);
  });

  it("renders a badge only when badgeLabel is provided", () => {
    const { rerender } = render(<CatalogItemCard {...baseProps} />);
    expect(screen.queryByText("Full-frame")).not.toBeInTheDocument();

    rerender(
      <CatalogItemCard
        {...baseProps}
        badgeLabel="Full-frame"
        badgeVariant="default"
      />,
    );
    expect(screen.getByText("Full-frame")).toBeInTheDocument();
  });

  it("links both CTAs to their own destination", () => {
    render(<CatalogItemCard {...baseProps} />);

    expect(screen.getByRole("link", { name: "View specs" })).toHaveAttribute(
      "href",
      "/cameras/sony-a7-iv",
    );
    expect(
      screen.getByRole("link", { name: "Add to compare" }),
    ).toHaveAttribute("href", "/compare?items=sony-a7-iv");
  });

  it("stacks the two CTAs full-width instead of splitting them side by side", () => {
    // Regression guard: a side-by-side `flex` row squeezed both buttons into
    // half the card's width, which overflowed once translated labels (e.g.
    // pt-BR "Adicionar à comparação") got long enough. Stacking them
    // full-width removes that failure mode regardless of label length.
    render(<CatalogItemCard {...baseProps} />);

    const viewSpecsLink = screen.getByRole("link", { name: "View specs" });
    const ctaRow = viewSpecsLink.closest("div");

    expect(ctaRow).toHaveClass("flex-col");
    expect(viewSpecsLink).not.toHaveClass("flex-1");
  });
});
