import { z } from "zod";

export const createSectionSchema = z.object({
  suiteId: z.coerce.bigint(),
  parentSectionId: z.coerce.bigint().nullable().optional(),
  name: z.string().min(1)
});

export const suiteIdParamSchema = z.object({
  suiteId: z.coerce.bigint()
});

export const sectionIdParamSchema = z.object({
  sectionId: z.coerce.bigint()
});

export const updateSectionSchema = z.object({
  parentSectionId: z.coerce.bigint().nullable().optional(),
  name: z.string().min(1).optional()
});

export const reorderSectionsSchema = z.object({
  parentSectionId: z.coerce.bigint().nullable().optional(),
  orderedSectionIds: z.array(z.coerce.bigint()).min(1).max(500)
});

export const copySectionSchema = z.object({
  targetParentSectionId: z.coerce.bigint().nullable().optional()
});
