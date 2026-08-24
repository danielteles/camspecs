import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompareActions } from "@/components/compare-actions";
import { CompareTransitionProvider } from "@/components/compare-transition-provider";
import {
  mockRouterReplace,
  mockUsePathname,
  mockUseSearchParams,
} from "@/test/mocks/navigation";

function renderCompareActions() {
  return render(
    <CompareTransitionProvider>
      <CompareActions />
    </CompareTransitionProvider>,
  );
}

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

describe("CompareActions", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/compare");
  });

  it("renders nothing when no items are selected", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    const { container } = renderCompareActions();

    expect(container).toBeEmptyDOMElement();
  });

  it("only shows the swap button when exactly two items are selected", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("items=sony-a7-iv"),
    );
    renderCompareActions();

    expect(
      screen.queryByRole("button", { name: "Swap items" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
  });

  it("swaps the order of the two selected items", async () => {
    const user = userEvent.setup();
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("items=sony-a7-iv,fujifilm-x-t5"),
    );
    renderCompareActions();

    await user.click(screen.getByRole("button", { name: "Swap items" }));

    expect(mockRouterReplace).toHaveBeenCalledWith(
      { pathname: "/compare", query: { items: "fujifilm-x-t5,sony-a7-iv" } },
      { scroll: false },
    );
  });

  it("does not offer to swap when more than two items are selected", () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("items=sony-a7-iv,fujifilm-x-t5,om-system-om-1"),
    );
    renderCompareActions();

    expect(
      screen.queryByRole("button", { name: "Swap items" }),
    ).not.toBeInTheDocument();
  });

  it("copies the current URL to the clipboard and shows feedback", async () => {
    const user = userEvent.setup();
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("items=sony-a7-iv"),
    );
    const writeText = stubClipboard();

    renderCompareActions();

    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(
      await screen.findByRole("button", { name: "Copied!" }),
    ).toBeInTheDocument();
  });
});
