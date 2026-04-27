import { z } from "zod";

const rawPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  page_size: z.coerce.number().int().min(1).max(100).optional()
});

export const paginationQuerySchema = rawPaginationSchema.transform((raw) => ({
  page: raw.page,
  // Canonical naming is pageSize; page_size stays as backward-compatible alias.
  pageSize: raw.pageSize ?? raw.page_size ?? 20
}));
