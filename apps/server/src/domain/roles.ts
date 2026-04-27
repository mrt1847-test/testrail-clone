export const projectRoles = ["owner", "manager", "tester", "viewer"] as const;
export type ProjectRole = (typeof projectRoles)[number];
