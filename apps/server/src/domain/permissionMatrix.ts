import type { ProjectRole } from "./roles.js";

export const GLOBAL_ROLES = ["user", "instance_admin"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const PROJECT_PERMISSIONS = [
  "cases.read",
  "cases.write",
  "runs.read",
  "runs.write",
  "results.write",
  "settings.read",
  "settings.write",
  "members.manage"
] as const;

export type ProjectPermission = (typeof PROJECT_PERMISSIONS)[number];

/** Legacy mutation gate (owner, manager, tester). */
export const PROJECT_MUTATE_PERMISSION: ProjectPermission = "cases.write";

export const PROJECT_PERMISSION_LABELS: Record<ProjectPermission, string> = {
  "cases.read": "View test cases",
  "cases.write": "Create and edit test cases",
  "runs.read": "View test runs and plans",
  "runs.write": "Create and manage test runs",
  "results.write": "Enter and edit test results",
  "settings.read": "View project settings",
  "settings.write": "Manage project settings (fields, statuses, webhooks)",
  "members.manage": "Manage project members and roles"
};

const ALL_PERMISSIONS: ProjectPermission[] = [...PROJECT_PERMISSIONS];

const builtInRolePermissions: Record<ProjectRole, ProjectPermission[]> = {
  owner: ALL_PERMISSIONS,
  manager: [
    "cases.read",
    "cases.write",
    "runs.read",
    "runs.write",
    "results.write",
    "settings.read",
    "settings.write",
    "members.manage"
  ],
  tester: ["cases.read", "cases.write", "runs.read", "runs.write", "results.write"],
  viewer: ["cases.read", "runs.read", "settings.read"]
};

export function isGlobalRole(value: string): value is GlobalRole {
  return (GLOBAL_ROLES as readonly string[]).includes(value);
}

export function isProjectPermission(value: string): value is ProjectPermission {
  return (PROJECT_PERMISSIONS as readonly string[]).includes(value);
}

export function normalizeProjectPermissions(values: string[] | undefined): ProjectPermission[] {
  if (!values?.length) return [];
  const normalized: ProjectPermission[] = [];
  for (const value of values) {
    if (!isProjectPermission(value)) continue;
    if (!normalized.includes(value)) normalized.push(value);
  }
  return normalized;
}

export function permissionsForBuiltInRole(role: ProjectRole): ProjectPermission[] {
  return [...builtInRolePermissions[role]];
}

export function hasProjectPermission(
  effectivePermissions: readonly ProjectPermission[],
  required: ProjectPermission
): boolean {
  return effectivePermissions.includes(required);
}

export function canMutateProjectWithPermissions(effectivePermissions: readonly ProjectPermission[]): boolean {
  return (
    hasProjectPermission(effectivePermissions, "cases.write") ||
    hasProjectPermission(effectivePermissions, "runs.write") ||
    hasProjectPermission(effectivePermissions, "results.write")
  );
}

export function buildPermissionMatrixCatalog() {
  return {
    permissions: PROJECT_PERMISSIONS.map((key) => ({
      key,
      label: PROJECT_PERMISSION_LABELS[key]
    })),
    builtInRoles: (Object.keys(builtInRolePermissions) as ProjectRole[]).map((role) => ({
      role,
      permissions: builtInRolePermissions[role]
    }))
  };
}
