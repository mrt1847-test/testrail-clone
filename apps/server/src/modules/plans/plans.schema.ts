import { z } from "zod";

const optionalAssignee = z.coerce.bigint().nullable().optional();
const optionalDate = z.coerce.date().nullable().optional();
const refsField = z.string().max(4000).nullable().optional();
const caseIdsField = z.array(z.coerce.bigint()).optional();

export const planBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  assignedTo: optionalAssignee,
  refs: refsField,
  startDate: optionalDate,
  dueOn: optionalDate
});

export const planEntryBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  environment: z.string().trim().max(120).nullable().optional(),
  suiteId: z.coerce.bigint().nullable().optional(),
  assignedTo: optionalAssignee,
  refs: refsField,
  startDate: optionalDate,
  dueOn: optionalDate,
  includeAll: z.boolean().optional(),
  includeCaseIds: caseIdsField,
  excludeCaseIds: caseIdsField,
  isIncluded: z.boolean().optional(),
  configurationIds: z.array(z.coerce.bigint()).optional()
});

export const entryConfigurationsBodySchema = z.object({
  configurationIds: z.array(z.coerce.bigint()).default([])
});
