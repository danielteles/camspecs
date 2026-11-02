import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompareSelector } from "@/components/compare-selector";
import { CompareTransitionProvider } from "@/components/compare-transition-provider";
import { buildCatalog, type CatalogItem } from "@/lib/search";
import { installCatalogFetchMock } from "@/test/mocks/catalog-fetch";
import { CAMERAS, LENSES } from "@/test/mocks/equipment";
import {
  mockRouterReplace,
  mockUsePathname,
  mockUseSearchParams,
} from "@/test/mocks/navigation";

const CATALOG = buildCatalog(CAMERAS, LENSES);
const SONY_A7_IV = CATALOG.find((item) => item.slug === "sony-a7-iv");

function renderCompareSelector(initialItems: CatalogItem[] = []) {
  return render(
    <CompareTransitionProvider>
      <CompareSelector initialItems={initialItems} />
    </CompareTransitionProvider>,
  );
}

async function openAndType(query: string) {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Add a camera or lens…" }),
  );
  await user.type(
    screen.getByPlaceholderText("Search by brand or model…"),
    query,
  );
  return user;
}

describe("CompareSelector", () => {
  let fetchMock: ReturnType<typeof installCatalogFetchMock>;

  beforeEach(() => {
    mockUsePathname.mockReturnValue("/compare");
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    fetchMock = installCatalogFetchMock();
  });

  it("searches the catalog and adds the selected item to the comparison", async () => {
    renderCompareSelector();
    const user = await openAndType("sony");

    await user.click(await screen.findByText("Sony Alpha 7 IV"));

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith(
        { pathname: "/compare", query: { items: "sony-a7-iv" } },
        { scroll: false },
      ),
    );
  });

  it("loads the catalog once and searches it locally on every keystroke", async () => {
    renderCompareSelector();
    const user = await openAndType("sony");
    await screen.findByText("Sony Alpha 7 IV");

    await user.clear(screen.getByPlaceholderText("Search by brand or model…"));
    await user.type(
      screen.getByPlaceholderText("Search by brand or model…"),
      "x-t5",
    );

    expect(await screen.findByText("Fujifilm X-T5")).toBeInTheDocument();
    expect(screen.queryByText("Sony Alpha 7 IV")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/catalog", expect.anything());
  });

  it("renders a chip for each item already selected via the URL without loading the catalog", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("items=sony-a7-iv"),
    );

    renderCompareSelector(SONY_A7_IV ? [SONY_A7_IV] : []);

    expect(
      screen.getByRole("list", { name: "Items to compare" }),
    ).toHaveTextContent("Sony Alpha 7 IV");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes an item when its chip's remove button is clicked", async () => {
    const user = userEvent.setup();
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("items=sony-a7-iv"),
    );

    renderCompareSelector(SONY_A7_IV ? [SONY_A7_IV] : []);

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
    renderCompareSelector();
    await openAndType("nonexistent brand");

    expect(await screen.findByText("No results found.")).toBeInTheDocument();
  });

  it("shows an error state and stops loading when the catalog fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down"))),
    );

    renderCompareSelector();
    await openAndType("sony");

    expect(
      await screen.findByText("Something went wrong searching. Try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Searching…")).not.toBeInTheDocument();
  });

  it("retries a failed catalog load when the popover is reopened", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network down"))),
    );
    renderCompareSelector();
    const user = await openAndType("sony");
    await screen.findByText("Something went wrong searching. Try again.");

    const retryFetch = installCatalogFetchMock();
    await user.keyboard("{Escape}");
    // The query survives closing the popover, so reopening re-runs it.
    await user.click(
      screen.getByRole("button", { name: "Add a camera or lens…" }),
    );

    expect(await screen.findByText("Sony Alpha 7 IV")).toBeInTheDocument();
    expect(retryFetch).toHaveBeenCalledTimes(1);
  });
});
