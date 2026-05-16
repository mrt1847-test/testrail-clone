import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";
import {
  isTokenExpired,
  normalizeApiTokenScopes,
  tokenHasScopes,
  type ApiTokenScope
} from "../../domain/apiTokenScopes.js";

export type ResolvedApiToken = {
  id: bigint;
  projectId: bigint;
  userId: bigint;
  scopes: string[];
  expiresAt: Date | null;
};

export function hashApiToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function isProjectApiToken(rawToken: string) {
  return rawToken.startsWith("tok_");
}

export async function resolveProjectApiToken(
  prisma: PrismaClient,
  rawToken: string
): Promise<ResolvedApiToken | null> {
  if (!isProjectApiToken(rawToken)) return null;

  const tokenHash = hashApiToken(rawToken);
  const row = await prisma.apiToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      projectId: { not: null }
    },
    select: {
      id: true,
      projectId: true,
      userId: true,
      scopes: true,
      expiresAt: true
    }
  });

  if (!row?.projectId) return null;
  if (isTokenExpired(row.expiresAt)) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    scopes: normalizeApiTokenScopes(row.scopes),
    expiresAt: row.expiresAt
  };
}

export async function touchApiTokenLastUsed(prisma: PrismaClient, tokenId: bigint) {
  await prisma.apiToken.update({
    where: { id: tokenId },
    data: { lastUsedAt: new Date() }
  });
}

export function assertApiTokenScopes(token: ResolvedApiToken, required: ApiTokenScope | ApiTokenScope[]) {
  if (!tokenHasScopes(token.scopes, required)) {
    const requiredList = Array.isArray(required) ? required : [required];
    const missing = requiredList.filter((scope) => !token.scopes.includes(scope));
    throw new AppError("FORBIDDEN", `token missing required scope(s): ${missing.join(", ")}`, 403);
  }
}

export function assertApiTokenProject(token: ResolvedApiToken, projectId: bigint) {
  if (token.projectId !== projectId) {
    throw new AppError("FORBIDDEN", "token project does not match request project", 403);
  }
}
