import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { CompareSelector } from "@/components/compare-selector";
import { CompareTransitionProvider } from "@/components/compare-transition-provider";
import {
  mockRouterReplace,
  mockUsePathname,
  mockUseSearchParams,
} from "@/test/mocks/navigation";
import { installSearchFetchMock } from "@/test/mocks/search-fetch";

function renderCompareSelector() {
  return render(
    <CompareTransitionProvider>
      <CompareSelector />
    </CompareTransitionProvider>,
  );
}

describe("CompareSelector", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/compare");
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    installSearchFetchMock();
  });

  it("searches the catalog and adds the selected item to the comparison", async () => {
    const user = userEvent.setup();
    renderCompareSelector();

    await user.click(
      screen.getByRole("button", { name: "Add a camera or lens…" }),
    );
    await user.type(
      screen.getByPlaceholderText("Search by brand or model…"),
      "sony",
    );

    const option = await screen.findByText(
      "Sony Alpha 7 IV",
      {},
      { timeout: 2000 },
    );
    await user.click(option);

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith(
        { pathname: "/compare", query: { items: "sony-a7-iv" } },
        { scroll: false },
      ),
    );
  });

  it("renders a chip for each item already selected via the URL", async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("items=sony-a7-iv"),
    );

    renderCompareSelector();

    expect(
      await screen.findByText("Sony Alpha 7 IV", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Items to compare" }),
    ).toBeInTheDocument();
  });

  it("removes an item when its chip's remove button is clicked", async () => {
    const user = userEvent.setup();
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("items=sony-a7-iv"),
    );

    renderCompareSelector();

    await screen.findByText("Sony Alpha 7 IV", {}, { timeout: 2000 });
    await user.click(
      screen.getByRole("button", {
        name: "Remove Sony Alpha 7 IV from comparison",
      }),
    );

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith(
        { pathname: "/compare" },
        { scroll: false },
      ),
    );
  });

  it("shows an empty state when the search has no matches", async () => {
    const user = userEvent.setup();
    renderCompareSelector();

    await user.click(
      screen.getByRole("button", { name: "Add a camera or lens…" }),
    );
    await user.type(
      screen.getByPlaceholderText("Search by brand or model…"),
      "nonexistent brand",
    );

    expect(
      await screen.findByText("No results found.", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });
});
