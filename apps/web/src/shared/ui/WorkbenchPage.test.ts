import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkbenchPageHeader, WorkbenchToolbar } from "./WorkbenchPage";

describe("workbench page chrome", () => {
  it("renders a flat header without a card shadow or boxed border", () => {
    const html = renderToStaticMarkup(
      createElement(WorkbenchPageHeader, { title: "Test Runs & Results", primaryAction: "Add" })
    );
    expect(html).toContain("data-page-chrome=\"header\"");
    expect(html).toContain("border-b");
    expect(html).not.toContain("shadow-sm");
    expect(html).not.toContain("border border-slate-300");
  });

  it("renders a flat toolbar without a nested card container", () => {
    const html = renderToStaticMarkup(createElement(WorkbenchToolbar, { children: "My runs" }));
    expect(html).toContain("data-page-chrome=\"toolbar\"");
    expect(html).toContain("aria-label=\"Workbench tools\"");
    expect(html).not.toContain("shadow-sm");
    expect(html).not.toContain("border border-slate-300");
  });
});
