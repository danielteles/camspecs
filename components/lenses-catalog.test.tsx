import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LensesCatalog } from "@/components/lenses-catalog";
import { LENSES } from "@/lib/mock-data";

describe("LensesCatalog", () => {
  it("renders a card for every lens", () => {
    render(<LensesCatalog lenses={LENSES} />);

    expect(
      screen.getByRole("heading", { name: "Sony FE 50mm F1.8" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Fujifilm XF 16-55mm F2.8 R LM WR",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Olympus M.Zuiko Digital 25mm F1.8",
      }),
    ).toBeInTheDocument();
  });

  it("filters the grid as the user types in the search box", async () => {
    const user = userEvent.setup();
    render(<LensesCatalog lenses={LENSES} />);

    await user.type(
      screen.getByRole("textbox", { name: "Search lenses" }),
      "olympus",
    );

    expect(
      screen.getByRole("heading", {
        name: "Olympus M.Zuiko Digital 25mm F1.8",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sony FE 50mm F1.8" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches the search", async () => {
    const user = userEvent.setup();
    render(<LensesCatalog lenses={LENSES} />);

    await user.type(
      screen.getByRole("textbox", { name: "Search lenses" }),
      "nonexistent",
    );

    expect(
      screen.getByText("No lenses match your search."),
    ).toBeInTheDocument();
  });

  it("filters the grid by mount", async () => {
    const user = userEvent.setup();
    render(<LensesCatalog lenses={LENSES} />);

    await user.click(screen.getByRole("button", { name: "Fujifilm X" }));

    expect(
      screen.getByRole("heading", {
        name: "Fujifilm XF 16-55mm F2.8 R LM WR",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sony FE 50mm F1.8" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(
      screen.getByRole("heading", { name: "Sony FE 50mm F1.8" }),
    ).toBeInTheDocument();
  });

  it("links each card's actions to the product page and the compare page", () => {
    render(<LensesCatalog lenses={LENSES} />);

    expect(
      screen.getAllByRole("link", { name: "View specs" })[0],
    ).toHaveAttribute("href", "/lenses/sony-fe-50mm-f1-8");
    expect(
      screen.getAllByRole("link", { name: "Add to compare" })[0],
    ).toHaveAttribute("href", "/compare?items=sony-fe-50mm-f1-8");
  });
});
