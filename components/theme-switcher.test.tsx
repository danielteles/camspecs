import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { THEME_STORAGE_KEY } from "@/lib/theme";

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("ThemeSwitcher", () => {
  it("offers the three themes, with the system theme selected by default", () => {
    render(<ThemeSwitcher />);

    const group = screen.getByRole("group", { name: "Theme" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "System theme" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Light theme" }),
    ).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark theme" })).not.toBeChecked();
  });

  it("restores a saved choice", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeSwitcher />);

    expect(screen.getByRole("radio", { name: "Dark theme" })).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("applies and saves the chosen theme", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByRole("radio", { name: "Dark theme" }));
    expect(screen.getByRole("radio", { name: "Dark theme" })).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await user.click(screen.getByRole("radio", { name: "Light theme" }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    await user.click(screen.getByRole("radio", { name: "System theme" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("keeps two switchers on the page in sync", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ThemeSwitcher />
        <ThemeSwitcher />
      </>,
    );

    const [first, second] = screen.getAllByRole("radio", {
      name: "Dark theme",
    });
    await user.click(first!);

    expect(first).toBeChecked();
    expect(second).toBeChecked();
  });
});
