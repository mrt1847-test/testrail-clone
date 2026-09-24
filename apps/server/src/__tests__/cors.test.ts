import { describe, expect, it } from "vitest";

import { env } from "../config/env.js";
import {
  isAllowedWebOrigin,
  normalizeOrigin,
  parseWebOrigins
} from "../config/webOrigins.js";
import { buildApp } from "../app.js";

describe("web origin parsing", () => {
  it("strips quotes, whitespace, and trailing slashes", () => {
    expect(normalizeOrigin(' "https://testrail-clone-web.vercel.app/" ')).toBe(
      "https://testrail-clone-web.vercel.app"
    );
  });

  it("parses a comma-separated list", () => {
    expect(parseWebOrigins("https://a.example, https://b.example/")).toEqual([
      "https://a.example",
      "https://b.example"
    ]);
  });

  it("allows the configured origin and same-project Vercel previews", () => {
    const allowed = ["https://testrail-clone-web.vercel.app"];
    expect(isAllowedWebOrigin("https://testrail-clone-web.vercel.app/", allowed)).toBe(true);
    expect(
      isAllowedWebOrigin("https://testrail-clone-web-git-main.vercel.app", allowed)
    ).toBe(true);
    expect(isAllowedWebOrigin("https://other-app.vercel.app", allowed)).toBe(false);
    expect(isAllowedWebOrigin("http://localhost:5176", allowed)).toBe(true);
  });
});

describe("login CORS preflight", () => {
  it("returns Access-Control-Allow-Origin for the configured web origin", async () => {
    const app = buildApp();
    await app.ready();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/auth/login",
      headers: {
        origin: env.webOrigin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type"
      }
    });
    await app.close();

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(env.webOrigin);
  });
});
