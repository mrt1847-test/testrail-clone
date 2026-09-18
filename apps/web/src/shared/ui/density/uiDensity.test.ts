import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readUiDensity,
  surfaceDefaultUiDensity,
  tableDensityClasses,
  uiDensityStorageKey,
  writeUiDensity
} from "./uiDensity";

describe("uiDensity surface defaults", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        clear: () => store.clear()
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults run execution to compact and other surfaces to comfortable", () => {
    expect(surfaceDefaultUiDensity("run-execution")).toBe("compact");
    expect(surfaceDefaultUiDensity("case-repository")).toBe("comfortable");
    expect(readUiDensity("p1", "run-execution", "u1")).toBe("compact");
    expect(readUiDensity("p1", "case-repository", "u1")).toBe("comfortable");
  });

  it("honors a stored comfortable preference on run execution", () => {
    writeUiDensity("p1", "run-execution", "comfortable", "u1");
    expect(store.get(uiDensityStorageKey("p1", "run-execution", "u1"))).toBe("comfortable");
    expect(readUiDensity("p1", "run-execution", "u1")).toBe("comfortable");
  });

  it("uses shorter compact table padding than comfortable", () => {
    expect(tableDensityClasses("compact").cell).toContain("py-1");
    expect(tableDensityClasses("comfortable").cell).toContain("py-2");
  });
});
