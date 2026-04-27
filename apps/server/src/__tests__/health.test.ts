import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { testRailStatusMap } from "../domain/testrailMapping.js";
import { buildApp } from "../app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("status map", () => {
  it("maps testrail status id 1 to passed", () => {
    expect(testRailStatusMap[1]).toBe("passed");
  });
});

describe("health endpoint", () => {
  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
