import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { CamerasCatalog } from "@/components/cameras-catalog";
import {
  mockRouterReplace,
  mockUsePathname,
  mockUseSearchParams,
} from "@/test/mocks/navigation";
import { CAMERAS } from "@/test/mocks/equipment";

const SONY = CAMERAS[0]!; // sony-a7-iv, full-frame, sony-e, 33MP, 658g

describe("CamerasCatalog", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/cameras");
  });

  it("renders a card for every camera in the (server-filtered) cameras prop", () => {
    render(<CamerasCatalog cameras={CAMERAS} allCameras={CAMERAS} />);

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

  it("narrows the grid as the user types in the search box", async () => {
    const user = userEvent.setup();
    render(<CamerasCatalog cameras={CAMERAS} allCameras={CAMERAS} />);

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
  });

  it("shows a reset CTA and clears the search when nothing matches", async () => {
    const user = userEvent.setup();
    render(<CamerasCatalog cameras={CAMERAS} allCameras={CAMERAS} />);

    await user.type(
      screen.getByRole("textbox", { name: "Search cameras" }),
      "nonexistent brand",
    );

    expect(
      screen.getByText("No cameras match your selected criteria."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset filters" }));

    expect(screen.getByRole("textbox", { name: "Search cameras" })).toHaveValue(
      "",
    );
    expect(mockRouterReplace).toHaveBeenCalledWith(
      { pathname: "/cameras" },
      { scroll: false },
    );
  });

  it("renders each brand as a checkbox with a dataset-wide count", () => {
    render(<CamerasCatalog cameras={CAMERAS} allCameras={CAMERAS} />);

    expect(
      screen.getByRole("checkbox", { name: /^Sony,/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /^Fujifilm,/ }),
    ).toBeInTheDocument();
  });

  it("updates the URL when a brand checkbox is checked", async () => {
    const user = userEvent.setup();
    render(<CamerasCatalog cameras={CAMERAS} allCameras={CAMERAS} />);

    await user.click(screen.getByRole("checkbox", { name: /^Sony,/ }));

    expect(mockRouterReplace).toHaveBeenCalledWith(
      { pathname: "/cameras", query: { brand: "Sony" } },
      { scroll: false },
    );
  });

  it("pre-checks a brand box and shows an active badge for a filter already in the URL", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("brand=Sony"));

    render(<CamerasCatalog cameras={[SONY]} allCameras={CAMERAS} />);

    expect(screen.getByRole("checkbox", { name: /^Sony,/ })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Remove Sony filter" }),
    ).toBeInTheDocument();
  });

  it("clears just that filter when its active badge is removed", async () => {
    const user = userEvent.setup();
    mockUseSearchParams.mockReturnValue(new URLSearchParams("brand=Sony"));

    render(<CamerasCatalog cameras={[SONY]} allCameras={CAMERAS} />);

    await user.click(
      screen.getByRole("button", { name: "Remove Sony filter" }),
    );

    expect(mockRouterReplace).toHaveBeenCalledWith(
      { pathname: "/cameras" },
      { scroll: false },
    );
  });

  it("shows the active filter count on the mobile filter trigger", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("brand=Sony"));

    render(<CamerasCatalog cameras={[SONY]} allCameras={CAMERAS} />);

    expect(screen.getByRole("button", { name: /Filters/ })).toHaveTextContent(
      "1",
    );
  });

  it("sets min_megapixels (not the dataset minimum) when the resolution slider moves", async () => {
    const user = userEvent.setup();
    render(<CamerasCatalog cameras={CAMERAS} allCameras={CAMERAS} />);

    const thumb = screen.getByRole("slider", { name: "Minimum resolution" });
    thumb.focus();
    await user.keyboard("{ArrowRight}");

    // Dataset min megapixels is 20.4 (OM-1); Radix Slider rounds keyboard
    // steps to the step prop's own decimal precision (step=1 -> 0 decimals),
    // so one ArrowRight lands on 21, not 21.4 — still not the neutral/no-op
    // starting value, so it's still encoded into the URL.
    expect(mockRouterReplace).toHaveBeenCalledWith(
      { pathname: "/cameras", query: { min_megapixels: "21" } },
      { scroll: false },
    );
  });

  it("omits the weight facet entirely when no camera in the dataset has a weight", () => {
    const noWeightCameras = CAMERAS.map((c) => ({ ...c, weightG: null }));
    render(
      <CamerasCatalog cameras={noWeightCameras} allCameras={noWeightCameras} />,
    );

    expect(
      screen.queryByRole("button", { name: "Maximum weight" }),
    ).not.toBeInTheDocument();
  });

  it("links each card's actions to the product page and the compare page", () => {
    render(<CamerasCatalog cameras={CAMERAS} allCameras={CAMERAS} />);

    expect(
      screen.getAllByRole("link", { name: "View specs" })[0],
    ).toHaveAttribute("href", "/cameras/sony-a7-iv");
    expect(
      screen.getAllByRole("link", { name: "Add to compare" })[0],
    ).toHaveAttribute("href", "/compare?items=sony-a7-iv");
  });
});
