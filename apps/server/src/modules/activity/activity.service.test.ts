import { describe, expect, it } from "vitest";

import { extractMentionTokens } from "./activity.service.js";

describe("activity mention helpers", () => {
  it("extracts unique email, local-part, and name mention tokens", () => {
    expect(extractMentionTokens("Please check @qa@example.com and @qa plus @Lead_User. @qa")).toEqual([
      "qa@example.com",
      "qa",
      "lead_user"
    ]);
  });

  it("ignores plain email addresses without an @mention boundary", () => {
    expect(extractMentionTokens("Send mail to qa@example.com, then mention @lead.")).toEqual(["lead"]);
  });
});
