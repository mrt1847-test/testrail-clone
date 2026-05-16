import { z } from "zod";

import { API_TOKEN_SCOPES } from "../../domain/apiTokenScopes.js";

export const createTokenBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  scopes: z.array(z.enum(API_TOKEN_SCOPES)).min(1).optional(),
  /** Omit or null for no expiration. */
  expiresInDays: z.coerce.number().int().min(1).max(3650).nullable().optional()
});

export const tokenIdParamSchema = z.object({
  tokenId: z.coerce.bigint()
});
