import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("/api/v2 TestRail adapter contract", () => {
  it("exposes get_projects as a JSON array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/get_projects" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: number; name: string; is_completed: boolean }>;
    expect(Array.isArray(body)).toBe(true);
  });

  it("returns 404 for unknown case on get_case", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/get_case/999999999" });
    expect(res.statusCode).toBe(404);
  });
});
