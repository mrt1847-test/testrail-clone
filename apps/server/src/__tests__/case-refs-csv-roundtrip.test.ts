import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { env } from "../config/env.js";
import { buildApp } from "../app.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
const app = buildApp();

function parseCsvRows(csv: string): Array<Record<string, string>> {
  const lines = csv.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  const [headerLine, ...body] = lines;
  const headers = headerLine!.split(",").map((cell) => cell.trim());
  return body.map((line) => {
    const cells: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]!;
      const next = line[i + 1];
      if (quoted) {
        if (ch === '"' && next === '"') {
          field += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else {
          field += ch;
        }
        continue;
      }
      if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        cells.push(field);
        field = "";
      } else {
        field += ch;
      }
    }
    cells.push(field);
    return Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()]));
  });
}

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe.skipIf(!integrationEnabled)("case refs CSV export/import", () => {
  it("exports refs column with empty cells and round-trips via References import header", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Refs CSV project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/suites`,
      headers,
      payload: { name: "Suite" }
    });
    const suite = suiteRes.json() as { data: { id: string } };

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suite.data.id}/sections`,
      headers,
      payload: { name: "Section" }
    });
    const section = sectionRes.json() as { data: { id: string } };

    await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers,
      payload: { title: "No refs case" }
    });

    const withRefsRes = await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers,
      payload: { title: "Refs export case", refs: "REQ-EXP-1, REQ-EXP-2" }
    });
    expect(withRefsRes.statusCode).toBe(200);

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/cases/export/csv`,
      headers
    });
    expect(exportRes.statusCode).toBe(200);
    const csv = exportRes.body;
    expect(csv).toContain("refs");
    const exportedRows = parseCsvRows(csv);
    expect(exportedRows[0]).toHaveProperty("refs");
    const exported = exportedRows.find((row) => row.title === "Refs export case");
    expect(exported?.refs).toBe("REQ-EXP-1, REQ-EXP-2");
    const withoutRefs = exportedRows.find((row) => row.title === "No refs case");
    expect(withoutRefs?.refs).toBe("");

    const importCsv = [
      "section_id,title,References",
      `${section.data.id},Imported via References,REQ-EXP-1, REQ-EXP-2`
    ].join("\n");

    const importRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/cases/import/csv`,
      headers,
      payload: { csv: importCsv, dryRun: false, atomic: true }
    });
    expect(importRes.statusCode).toBe(200);
    const importBody = importRes.json() as { data: { summary: { imported: number } } };
    expect(importBody.data.summary.imported).toBe(1);

    const listRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/cases?refs=with`,
      headers
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as { data: Array<{ title: string; refs?: string | null }> };
    const imported = list.data.find((row) => row.title === "Imported via References");
    expect(imported?.refs).toBe("REQ-EXP-1, REQ-EXP-2");
  });

  it("includes refs in results explorer CSV export", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Result refs CSV" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/suites`,
      headers,
      payload: { name: "Suite" }
    });
    const suite = suiteRes.json() as { data: { id: string } };

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suite.data.id}/sections`,
      headers,
      payload: { name: "Section" }
    });
    const section = sectionRes.json() as { data: { id: string } };

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers,
      payload: { title: "Result refs case", refs: "REQ-RUN-1" }
    });
    const testCase = caseRes.json() as { data: { id: string } };

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/runs`,
      headers,
      payload: { name: "Run", suiteId: suite.data.id, includeAll: true }
    });
    expect(runRes.statusCode).toBe(200);
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/results`,
      headers,
      payload: { caseId: testCase.data.id, status: "passed" }
    });

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/reports/export?reportType=results_explorer&format=csv&maxRows=100`,
      headers
    });
    expect(exportRes.statusCode).toBe(200);
    const csv = exportRes.body;
    expect(csv).toContain("refs");
    const rows = parseCsvRows(csv);
    expect(rows.some((row) => row.refs === "REQ-RUN-1" && row.title === "Result refs case")).toBe(true);
  });
});
