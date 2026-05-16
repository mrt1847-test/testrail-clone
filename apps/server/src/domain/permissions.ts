import { canMutateProjectWithPermissions, permissionsForBuiltInRole } from "./permissionMatrix.js";
import type { ProjectRole } from "./roles.js";

export function canMutateProject(role: ProjectRole) {
  return canMutateProjectWithPermissions(permissionsForBuiltInRole(role));
}
