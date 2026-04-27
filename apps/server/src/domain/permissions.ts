import type { ProjectRole } from "./roles.js";

const mutationAllowedRoles: ProjectRole[] = ["owner", "manager", "tester"];

export function canMutateProject(role: ProjectRole) {
  return mutationAllowedRoles.includes(role);
}
