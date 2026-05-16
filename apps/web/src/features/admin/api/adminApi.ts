import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";

export type AccessDefaults = {
  defaultProjectMemberRole: string;
  newProjectAccessMode: string;
  scopeNote?: string;
};

export type PermissionMatrixCatalog = {
  permissions: Array<{ key: string; label: string }>;
  builtInRoles: Array<{ role: string; permissions: string[] }>;
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  isActive: boolean;
  groups: Array<{ id: string; name: string }>;
};

export type UserGroupRow = {
  id: string;
  name: string;
  description: string | null;
  members: Array<{ userId: string; email: string; name: string }>;
};

export async function fetchAccessDefaults(): Promise<AccessDefaults> {
  const res = await apiFetch<Ok<AccessDefaults>>("/api/admin/access-defaults");
  return res.data;
}

export async function updateAccessDefaults(patch: Partial<AccessDefaults>): Promise<AccessDefaults> {
  const res = await apiFetch<Ok<AccessDefaults>>("/api/admin/access-defaults", {
    method: "PATCH",
    body: patch
  });
  return res.data;
}

export async function fetchPermissionMatrix(): Promise<PermissionMatrixCatalog> {
  const res = await apiFetch<Ok<PermissionMatrixCatalog>>("/api/admin/permission-matrix");
  return res.data;
}

export async function fetchAdminUsers(page = 1, pageSize = 50): Promise<Paged<AdminUserRow>> {
  const res = await apiFetch<Paged<AdminUserRow>>(`/api/admin/users?page=${page}&pageSize=${pageSize}`);
  return {
    ...res,
    data: res.data.map((row) => ({ ...row, id: String(row.id) }))
  };
}

export async function updateAdminUser(
  userId: string,
  patch: { name?: string; globalRole?: string; isActive?: boolean }
) {
  const res = await apiFetch<Ok<AdminUserRow>>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: patch
  });
  return res.data;
}

export async function fetchUserGroups(): Promise<UserGroupRow[]> {
  const res = await apiFetch<Ok<UserGroupRow[]>>("/api/admin/groups");
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function createUserGroup(input: { name: string; description?: string | null }) {
  const res = await apiFetch<Ok<UserGroupRow>>("/api/admin/groups", {
    method: "POST",
    body: input
  });
  return { ...res.data, id: String(res.data.id) };
}
