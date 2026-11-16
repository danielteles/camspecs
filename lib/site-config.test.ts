import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupportUrl } from "@/lib/site-config";

describe("getSupportUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the configured https URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "https://ko-fi.com/camspecs");
    expect(getSupportUrl()).toBe("https://ko-fi.com/camspecs");
  });

  it("returns undefined when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "");
    expect(getSupportUrl()).toBeUndefined();
  });

  it.each(["http://ko-fi.com/camspecs", "javascript:alert(1)", "ko-fi.com"])(
    "rejects %s",
    (value) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", value);
      expect(getSupportUrl()).toBeUndefined();
    },
  );
});
