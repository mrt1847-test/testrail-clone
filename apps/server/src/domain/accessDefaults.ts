import { z } from "zod";

/** Roles that may be assigned by global defaults (never owner). */
export const defaultAssignableRoles = ["manager", "tester", "viewer"] as const;
export type DefaultAssignableRole = (typeof defaultAssignableRoles)[number];

export const newProjectAccessModes = ["creator_only", "all_active_users"] as const;
export type NewProjectAccessMode = (typeof newProjectAccessModes)[number];

export const ACCESS_DEFAULTS_SCOPE_NOTE =
  "Covers default project-member role and new-project membership grants only. Out of scope: custom roles, user groups, and the full permission matrix (see checklist line 52).";

export const defaultAccessDefaults = {
  defaultProjectMemberRole: "viewer" as DefaultAssignableRole,
  newProjectAccessMode: "creator_only" as NewProjectAccessMode
};

export const accessDefaultsResponseSchema = z.object({
  defaultProjectMemberRole: z.enum(defaultAssignableRoles),
  newProjectAccessMode: z.enum(newProjectAccessModes),
  scopeNote: z.string()
});

export const accessDefaultsPatchSchema = z
  .object({
    defaultProjectMemberRole: z.enum(defaultAssignableRoles).optional(),
    newProjectAccessMode: z.enum(newProjectAccessModes).optional()
  })
  .refine((body) => body.defaultProjectMemberRole !== undefined || body.newProjectAccessMode !== undefined, {
    message: "at least one field is required"
  });

export type AccessDefaultsResponse = z.infer<typeof accessDefaultsResponseSchema>;
