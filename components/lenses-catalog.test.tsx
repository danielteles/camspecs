import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { LensesCatalog } from "@/components/lenses-catalog";
import {
  mockRouterReplace,
  mockUsePathname,
  mockUseSearchParams,
} from "@/test/mocks/navigation";
import { LENSES } from "@/test/mocks/equipment";

describe("LensesCatalog", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/lenses");
  });

  it("renders a card for every lens in the (server-filtered) lenses prop", () => {
    render(<LensesCatalog lenses={LENSES} allLenses={LENSES} />);

    expect(
      screen.getByRole("heading", { name: "Sony FE 50mm F1.8" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fujifilm XF 16-55mm F2.8 R LM WR" }),
    ).toBeInTheDocument();
  });

  it("narrows the grid as the user types in the search box", async () => {
    const user = userEvent.setup();
    render(<LensesCatalog lenses={LENSES} allLenses={LENSES} />);

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

  it("shows a reset CTA when nothing matches the search", async () => {
    const user = userEvent.setup();
    render(<LensesCatalog lenses={LENSES} allLenses={LENSES} />);

    await user.type(
      screen.getByRole("textbox", { name: "Search lenses" }),
      "nonexistent brand",
    );

    expect(
      screen.getByText("No lenses match your selected criteria."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset filters" }),
    ).toBeInTheDocument();
  });

  it("updates the URL when the Prime checkbox is checked", async () => {
    const user = userEvent.setup();
    render(<LensesCatalog lenses={LENSES} allLenses={LENSES} />);

    await user.click(screen.getByRole("checkbox", { name: /^Prime,/ }));

    expect(mockRouterReplace).toHaveBeenCalledWith(
      { pathname: "/lenses", query: { focal_type: "prime" } },
      { scroll: false },
    );
  });

  it("pre-checks the Prime box and shows an active badge from the URL", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("focal_type=prime"),
    );

    render(
      <LensesCatalog
        lenses={LENSES.filter((l) => l.isPrime)}
        allLenses={LENSES}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /^Prime,/ })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Remove Prime filter" }),
    ).toBeInTheDocument();
  });

  it("clears just that filter when its active badge is removed", async () => {
    const user = userEvent.setup();
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("focal_type=prime"),
    );

    render(
      <LensesCatalog
        lenses={LENSES.filter((l) => l.isPrime)}
        allLenses={LENSES}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Remove Prime filter" }),
    );

    expect(mockRouterReplace).toHaveBeenCalledWith(
      { pathname: "/lenses" },
      { scroll: false },
    );
  });

  it("updates the URL when a brand checkbox is checked", async () => {
    const user = userEvent.setup();
    render(<LensesCatalog lenses={LENSES} allLenses={LENSES} />);

    await user.click(screen.getByRole("checkbox", { name: /^Sony,/ }));

    expect(mockRouterReplace).toHaveBeenCalledWith(
      { pathname: "/lenses", query: { brand: "Sony" } },
      { scroll: false },
    );
  });

  it("shows both min and max focal length thumbs with independent labels", () => {
    render(<LensesCatalog lenses={LENSES} allLenses={LENSES} />);

    expect(
      screen.getByRole("slider", { name: "Minimum focal length" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Maximum focal length" }),
    ).toBeInTheDocument();
  });

  it("links each card's actions to the product page and the compare page", () => {
    render(<LensesCatalog lenses={LENSES} allLenses={LENSES} />);

    expect(
      screen.getAllByRole("link", { name: "View specs" })[0],
    ).toHaveAttribute("href", "/lenses/sony-fe-50mm-f1-8");
    expect(
      screen.getAllByRole("link", { name: "Add to compare" })[0],
    ).toHaveAttribute("href", "/compare?items=sony-fe-50mm-f1-8");
  });
});
