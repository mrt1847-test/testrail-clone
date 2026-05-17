import { describe, expect, it } from "vitest";

import { memberLabelForUserId } from "./assigneeDisplay";

describe("memberLabelForUserId", () => {
  it("resolves member display names", () => {
    const members = [{ id: "1", userId: "9", email: "a@x.com", name: "Alex", role: "tester" as const }];
    expect(memberLabelForUserId(null, members)).toBe("Unassigned");
    expect(memberLabelForUserId("9", members)).toBe("Alex");
    expect(memberLabelForUserId("99", members)).toBe("User 99");
  });
});
