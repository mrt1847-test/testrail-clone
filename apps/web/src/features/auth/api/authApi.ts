import { apiFetch, setAccessToken } from "../../../shared/api/http";

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuthMembership = {
  projectId: string;
  role: string;
};

export type AuthBootstrap = {
  user: AuthUser;
  memberships: AuthMembership[];
};

export async function login(email: string, password: string) {
  const res = await apiFetch<{ token: string; user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });
  setAccessToken(res.token);
  return res.user;
}

export async function fetchMe() {
  const res = await apiFetch<{ user: AuthUser; memberships?: Array<{ projectId: string; role: string }> }>("/api/auth/me");
  return {
    user: res.user,
    memberships: (res.memberships ?? []).map((row) => ({
      projectId: String(row.projectId),
      role: row.role
    }))
  } satisfies AuthBootstrap;
}

export async function logout() {
  await apiFetch<void>("/api/auth/logout", { method: "POST" });
  setAccessToken(null);
}
