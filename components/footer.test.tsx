import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Footer } from "@/components/footer";

describe("Footer", () => {
  it("renders localized catalog links", async () => {
    render(await Footer());

    expect(screen.getByRole("link", { name: "Cameras" })).toHaveAttribute(
      "href",
      "/cameras",
    );
    expect(screen.getByRole("link", { name: "Lenses" })).toHaveAttribute(
      "href",
      "/lenses",
    );
  });

  it("renders popular comparison links with resolved product names", async () => {
    render(await Footer());

    const link = screen.getByRole("link", {
      name: "Sony Alpha 7 IV vs Fujifilm X-T5",
    });
    expect(link).toHaveAttribute(
      "href",
      "/compare?items=sony-a7-iv,fujifilm-x-t5",
    );
  });

  it("links to the GitHub repository in a new tab", async () => {
    render(await Footer());

    const link = screen.getByRole("link", { name: /GitHub repository/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/danielteles/camspecs",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("includes the language switcher", async () => {
    render(await Footer());

    expect(screen.getByRole("link", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Português" })).toBeInTheDocument();
  });
});
