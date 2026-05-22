import { describe, expect, it, vi } from "vitest";

import { resolveTheme } from "./themePreference";

describe("themePreference", () => {
  it("resolves system preference from matchMedia", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("dark"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }));
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
    vi.unstubAllGlobals();
  });
});
