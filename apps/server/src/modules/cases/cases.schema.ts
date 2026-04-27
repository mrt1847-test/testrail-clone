import { z } from "zod";

export const createCaseSchema = z.object({
  sectionId: z.coerce.bigint(),
  title: z.string().min(1),
  priority: z.string().optional(),
  caseType: z.string().optional()
});

export const caseIdParamSchema = z.object({
  caseId: z.coerce.bigint()
});

export const projectIdParamSchema = z.object({
  projectId: z.coerce.bigint()
});

export const sectionIdParamSchema = z.object({
  sectionId: z.coerce.bigint()
});

export const listCasesQuerySchema = z.object({
  projectId: z.coerce.bigint().optional(),
  sectionId: z.coerce.bigint().optional(),
  q: z.string().optional()
});

export const updateCaseSchema = z.object({
  title: z.string().min(1).optional(),
  priority: z.string().optional(),
  caseType: z.string().optional()
});
