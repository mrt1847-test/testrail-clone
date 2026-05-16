import { z } from "zod";

import { PROJECT_TYPES } from "../../domain/projectTypes.js";

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  projectType: z.enum(PROJECT_TYPES).default("single_repo")
});

export const projectIdParamSchema = z.object({
  projectId: z.coerce.bigint()
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  projectType: z.enum(PROJECT_TYPES).optional()
});
