import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WhereToBuy } from "@/components/where-to-buy";

describe("WhereToBuy", () => {
  it("renders nothing when there are no retailer links", async () => {
    const { container } = render(await WhereToBuy({ links: [] }));

    expect(container).toBeEmptyDOMElement();
  });

  it("renders sponsored retailer links that open in a new tab", async () => {
    render(
      await WhereToBuy({
        links: [
          {
            retailerId: "amazon",
            name: "Amazon",
            href: "https://www.amazon.com/s?k=Nikon+Zf&tag=camspecs-20",
          },
        ],
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Where to buy" }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: "Check price at Amazon (opens in a new tab)",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://www.amazon.com/s?k=Nikon+Zf&tag=camspecs-20",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute(
      "rel",
      "sponsored nofollow noopener noreferrer",
    );
  });

  it("discloses the affiliate relationship", async () => {
    render(
      await WhereToBuy({
        links: [
          { retailerId: "bh", name: "B&H Photo", href: "https://x.example" },
        ],
      }),
    );

    expect(screen.getByText(/may earn a commission/)).toBeInTheDocument();
  });
});
