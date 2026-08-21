import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CamerasCatalog } from "@/components/cameras-catalog";
import { CAMERAS } from "@/lib/mock-data";

describe("CamerasCatalog", () => {
  it("renders a card for every camera", () => {
    render(<CamerasCatalog cameras={CAMERAS} />);

    expect(
      screen.getByRole("heading", { name: "Sony Alpha 7 IV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fujifilm X-T5" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "OM System OM-1" }),
    ).toBeInTheDocument();
  });

  it("filters the grid as the user types in the search box", async () => {
    const user = userEvent.setup();
    render(<CamerasCatalog cameras={CAMERAS} />);

    await user.type(
      screen.getByRole("textbox", { name: "Search cameras" }),
      "fuji",
    );

    expect(
      screen.getByRole("heading", { name: "Fujifilm X-T5" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sony Alpha 7 IV" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "OM System OM-1" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches the search", async () => {
    const user = userEvent.setup();
    render(<CamerasCatalog cameras={CAMERAS} />);

    await user.type(
      screen.getByRole("textbox", { name: "Search cameras" }),
      "nonexistent brand",
    );

    expect(
      screen.getByText("No cameras match your search."),
    ).toBeInTheDocument();
  });

  it("filters the grid by sensor format", async () => {
    const user = userEvent.setup();
    render(<CamerasCatalog cameras={CAMERAS} />);

    await user.click(screen.getByRole("button", { name: "Full-frame" }));

    expect(
      screen.getByRole("heading", { name: "Sony Alpha 7 IV" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Fujifilm X-T5" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(
      screen.getByRole("heading", { name: "Fujifilm X-T5" }),
    ).toBeInTheDocument();
  });

  it("links each card's actions to the product page and the compare page", () => {
    render(<CamerasCatalog cameras={CAMERAS} />);

    expect(
      screen.getAllByRole("link", { name: "View specs" })[0],
    ).toHaveAttribute("href", "/cameras/sony-a7-iv");
    expect(
      screen.getAllByRole("link", { name: "Add to compare" })[0],
    ).toHaveAttribute("href", "/compare?items=sony-a7-iv");
  });
});
