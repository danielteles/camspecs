import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Navbar } from "@/components/navbar";
import { mockUsePathname } from "@/test/mocks/navigation";

describe("Navbar", () => {
  it("renders localized primary navigation links", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Navbar />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(nav).getByRole("link", { name: "Compare" })).toHaveAttribute(
      "href",
      "/compare",
    );
    expect(within(nav).getByRole("link", { name: "Cameras" })).toHaveAttribute(
      "href",
      "/cameras",
    );
    expect(within(nav).getByRole("link", { name: "Lenses" })).toHaveAttribute(
      "href",
      "/lenses",
    );
  });

  it("marks the current route active via aria-current", () => {
    mockUsePathname.mockReturnValue("/compare");
    render(<Navbar />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Compare" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("treats nested product routes as part of their catalog section", () => {
    mockUsePathname.mockReturnValue("/cameras/sony-a7-iv");
    render(<Navbar />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Cameras" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens the mobile drawer, then closes it after navigating", async () => {
    const user = userEvent.setup();
    mockUsePathname.mockReturnValue("/");
    render(<Navbar />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("CamSpecs")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("link", { name: "Compare" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
