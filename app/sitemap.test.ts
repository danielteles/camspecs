import { describe, expect, it, vi } from "vitest";

import sitemap from "@/app/sitemap";
import { routing } from "@/i18n/routing";
import { isDatabaseConfigured } from "@/lib/db/client";
import { SITE_URL } from "@/lib/site-config";
import { CAMERAS, LENSES } from "@/test/mocks/equipment";

// The equipment service and isDatabaseConfigured are globally mocked in
// vitest.setup.tsx: the service resolves from the CAMERAS/LENSES fixtures.

const STATIC_PATHS = ["", "/cameras", "/lenses", "/compare"];

const urlFor = (locale: string, path: string) => `${SITE_URL}/${locale}${path}`;

describe("sitemap", () => {
  it("lists every static, camera and lens page once per locale", async () => {
    const paths = [
      ...STATIC_PATHS,
      ...CAMERAS.map((camera) => `/cameras/${camera.slug}`),
      ...LENSES.map((lens) => `/lenses/${lens.slug}`),
    ];
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toHaveLength(paths.length * routing.locales.length);
    expect(new Set(urls).size).toBe(urls.length);
    for (const path of paths) {
      for (const locale of routing.locales) {
        expect(urls).toContain(urlFor(locale, path));
      }
    }
  });

  it("links each entry to its page in every locale", async () => {
    for (const entry of await sitemap()) {
      const path = entry.url.replace(/^.+?\/(en|pt-BR|es)(?=\/|$)/, "");
      expect(entry.alternates?.languages).toEqual(
        Object.fromEntries(
          routing.locales.map((locale) => [locale, urlFor(locale, path)]),
        ),
      );
    }
  });

  it("dates product pages by their last sync and leaves static pages undated", async () => {
    const entries = await sitemap();
    const camera = CAMERAS[0];
    const cameraEntry = entries.find(
      (entry) => entry.url === urlFor("en", `/cameras/${camera?.slug}`),
    );
    const homeEntry = entries.find((entry) => entry.url === urlFor("en", ""));

    expect(cameraEntry?.lastModified).toEqual(camera?.updatedAt);
    expect(homeEntry?.lastModified).toBeUndefined();
  });

  it("lists only the static pages when DATABASE_URL is unset", async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValueOnce(false);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toHaveLength(STATIC_PATHS.length * routing.locales.length);
    expect(urls.some((url) => url.includes("/cameras/"))).toBe(false);
  });
});
