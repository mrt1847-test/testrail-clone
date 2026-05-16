import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import { AppError } from "../../common/errors/appError.js";
import {
  computeTokenExpiresAt,
  normalizeApiTokenScopes,
  API_TOKEN_SCOPE_LABELS,
  API_TOKEN_SCOPES
} from "../../domain/apiTokenScopes.js";
import {
  getAuthenticatedUser,
  requireProjectMutationRole
} from "../../common/middlewares/authorization.js";
import type { AuthService } from "../auth/auth.service.js";
import { hashApiToken } from "./apiToken.service.js";
import { createTokenBodySchema, tokenIdParamSchema } from "./tokens.schema.js";

type TokenListRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

type InMemoryTokenRow = TokenListRow & {
  tokenHash: string;
  revokedAt: string | null;
};

const inMemoryTokens: InMemoryTokenRow[] = [];

const compatProjectIdSchema = z.object({ projectId: z.coerce.bigint() });

function mapTokenRow(row: {
  id: bigint;
  projectId: bigint;
  name: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}): TokenListRow {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    scopes: normalizeApiTokenScopes(row.scopes),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString()
  };
}

async function listProjectTokens(projectId: bigint, prisma?: PrismaClient) {
  if (prisma) {
    const rows = await prisma.apiToken.findMany({
      where: { projectId, revokedAt: null },
      orderBy: { id: "desc" },
      take: 100,
      select: {
        id: true,
        projectId: true,
        name: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true
      }
    });
    return rows.map((row) =>
      mapTokenRow({
        ...row,
        projectId: row.projectId ?? projectId
      })
    );
  }
  return inMemoryTokens
    .filter((item) => item.projectId === projectId && !item.revokedAt)
    .map(({ tokenHash: _hash, revokedAt: _revoked, ...row }) => row);
}

async function createProjectToken(
  projectId: bigint,
  userId: bigint,
  input: z.infer<typeof createTokenBodySchema>,
  prisma?: PrismaClient
) {
  const scopes = normalizeApiTokenScopes(input.scopes);
  const expiresAt = computeTokenExpiresAt(input.expiresInDays ?? null);
  const name = input.name?.trim() || "CI token";

  if (prisma) {
    const rawToken = `tok_${randomBytes(16).toString("hex")}`;
    const tokenHash = hashApiToken(rawToken);
    const created = await prisma.apiToken.create({
      data: {
        projectId,
        userId,
        name,
        tokenHash,
        scopes,
        expiresAt
      },
      select: {
        id: true,
        projectId: true,
        name: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true
      }
    });
    return {
      data: mapTokenRow({
        ...created,
        projectId: created.projectId ?? projectId
      }),
      rawToken
    };
  }

  const rawToken = `tok_${randomBytes(16).toString("hex")}`;
  const now = new Date().toISOString();
  const row: InMemoryTokenRow = {
    id: BigInt(Date.now()),
    projectId,
    name,
    scopes,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    lastUsedAt: null,
    createdAt: now,
    tokenHash: hashApiToken(rawToken),
    revokedAt: null
  };
  inMemoryTokens.unshift(row);
  const { tokenHash: _hash, revokedAt: _revoked, ...listed } = row;
  return { data: listed, rawToken };
}

async function revokeProjectToken(projectId: bigint, tokenId: bigint, prisma?: PrismaClient) {
  if (prisma) {
    const row = await prisma.apiToken.findFirst({
      where: { id: tokenId, projectId, revokedAt: null },
      select: { id: true }
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "token not found", 404);
    }
    await prisma.apiToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() }
    });
    return;
  }

  const index = inMemoryTokens.findIndex(
    (item) => item.projectId === projectId && item.id === tokenId && !item.revokedAt
  );
  if (index < 0) {
    throw new AppError("NOT_FOUND", "token not found", 404);
  }
  inMemoryTokens[index]!.revokedAt = new Date().toISOString();
}

export async function registerTokensRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  app.get("/api/projects/:projectId/tokens/scopes", async (_req, reply) => {
    return reply.send(
      toJsonSafe({
        data: API_TOKEN_SCOPES.map((scope) => ({
          scope,
          label: API_TOKEN_SCOPE_LABELS[scope]
        }))
      })
    );
  });

  app.get("/api/projects/:projectId/tokens", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const rows = await listProjectTokens(projectId, deps.prisma);
    return reply.send(toJsonSafe(paged(rows, 1, 100)));
  });

  app.post("/api/projects/:projectId/tokens", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = createTokenBodySchema.parse(req.body ?? {});
    const created = await createProjectToken(projectId, user.id, body, deps.prisma);
    return reply.send(toJsonSafe(created));
  });

  app.delete("/api/projects/:projectId/tokens/:tokenId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { tokenId } = tokenIdParamSchema.parse(req.params);
    await revokeProjectToken(projectId, tokenId, deps.prisma);
    return reply.status(204).send();
  });

  app.get("/api/tokens", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = compatProjectIdSchema.parse(req.query ?? {});
    const rows = await listProjectTokens(projectId, deps.prisma);
    return reply.send(toJsonSafe(paged(rows, 1, 100)));
  });

  app.post("/api/tokens", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const parsed = z
      .object({
        projectId: z.coerce.bigint(),
        name: z.string().optional(),
        scopes: z.array(z.enum(API_TOKEN_SCOPES)).min(1).optional(),
        expiresInDays: z.coerce.number().int().min(1).max(3650).nullable().optional()
      })
      .parse(req.body ?? {});
    const created = await createProjectToken(
      parsed.projectId,
      user.id,
      { name: parsed.name, scopes: parsed.scopes, expiresInDays: parsed.expiresInDays },
      deps.prisma
    );
    return reply.send(toJsonSafe(created));
  });

  app.delete("/api/tokens/:tokenId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const params = req.params as { tokenId: string };
    const { projectId } = compatProjectIdSchema.parse(req.query ?? {});
    await revokeProjectToken(projectId, BigInt(params.tokenId), deps.prisma);
    return reply.status(204).send();
  });
}

/** In-memory automation auth helper for tests. */
export function resolveInMemoryApiToken(rawToken: string): InMemoryTokenRow | null {
  const tokenHash = hashApiToken(rawToken);
  const row = inMemoryTokens.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null;
  return row;
}
