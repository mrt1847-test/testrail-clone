import { describe, expect, it } from "vitest";

import { escapeHtml, renderPrintDocumentHtml } from "./printHtml.js";

describe("printHtml", () => {
  it("escapes unsafe html", () => {
    expect(escapeHtml(`<script>"x"</script>`)).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  });

  it("renders a printable document shell", () => {
    const html = renderPrintDocumentHtml({
      entityType: "case",
      title: "Login test",
      subtitle: "Demo project",
      generatedAt: "2026-05-17T00:00:00.000Z",
      meta: [{ label: "Priority", value: "high" }],
      tables: [
        {
          title: "Steps",
          columns: ["#", "Step"],
          rows: [["1", "Open app"]]
        }
      ]
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Login test");
    expect(html).toContain("@media print");
  });
});
