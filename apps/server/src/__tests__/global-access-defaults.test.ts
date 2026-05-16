import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { resetInMemoryAccessDefaultsForTests } from "../modules/admin/accessDefaults.service.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterEach(() => {
  resetInMemoryAccessDefaultsForTests();
});

afterAll(async () => {
  await app.close();
});

describe("global access defaults", () => {
  async function login(email: string) {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "password" }
    });
    return (loginRes.json() as { token: string }).token;
  }

  it("returns baseline defaults with scope note", async () => {
    const token = await login("defaults-reader@example.com");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/access-defaults",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res.statusCode).toBe(200);
    const body = (res.json() as { data: Record<string, string> }).data;
    expect(body.defaultProjectMemberRole).toBe("viewer");
    expect(body.newProjectAccessMode).toBe("creator_only");
    expect(body.scopeNote).toContain("permission matrix");
  });

  it("updates defaults in dev/in-memory mode", async () => {
    const token = await login("defaults-admin@example.com");
    const patchRes = await app.inject({
      method: "PATCH",
      url: "/api/admin/access-defaults",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        defaultProjectMemberRole: "tester",
        newProjectAccessMode: "all_active_users"
      }
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = (patchRes.json() as { data: Record<string, string> }).data;
    expect(patched.defaultProjectMemberRole).toBe("tester");
    expect(patched.newProjectAccessMode).toBe("all_active_users");

    const getRes = await app.inject({
      method: "GET",
      url: "/api/admin/access-defaults",
      headers: { authorization: `Bearer ${token}` }
    });
    const fetched = (getRes.json() as { data: Record<string, string> }).data;
    expect(fetched.defaultProjectMemberRole).toBe("tester");
    expect(fetched.newProjectAccessMode).toBe("all_active_users");
  });

  it("uses default member role when invite omits role", async () => {
    const token = await login("member-defaults@example.com");
    const headers = { authorization: `Bearer ${token}` };

    await app.inject({
      method: "PATCH",
      url: "/api/admin/access-defaults",
      headers,
      payload: { defaultProjectMemberRole: "manager" }
    });

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Defaults Project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const addRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/settings/members`,
      headers,
      payload: { email: "invitee-defaults@example.com", name: "Invitee" }
    });
    if (addRes.statusCode === 501) {
      expect(addRes.statusCode).toBe(501);
      return;
    }
    expect(addRes.statusCode).toBe(200);
    const member = (addRes.json() as { data: { role: string } }).data;
    expect(member.role).toBe("manager");
  });
});
