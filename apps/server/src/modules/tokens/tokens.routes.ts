import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import { AppError } from "../../common/errors/appError.js";

type TokenRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  lastUsedAt: string | null;
};

const tokens: TokenRow[] = [];
const compatProjectIdSchema = z.object({ projectId: z.coerce.bigint() });
const createTokenBodySchema = z.object({ name: z.string().optional() });

async function listProjectTokens(projectId: bigint, prisma?: PrismaClient) {
  if (prisma) {
    const rows = await prisma.apiToken.findMany({
      where: { projectId, revokedAt: null },
      orderBy: { id: "desc" },
      take: 100
    });
    return rows.map((row: (typeof rows)[number]) => ({
      id: row.id,
      projectId: row.projectId ?? projectId,
      name: row.name,
      lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null
    }));
  }
  return tokens.filter((item) => item.projectId === projectId);
}

async function createProjectToken(projectId: bigint, input: { name?: string }, prisma?: PrismaClient) {
  if (prisma) {
    const rawToken = `tok_${randomBytes(16).toString("hex")}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const created = await prisma.apiToken.create({
      data: {
        projectId,
        userId: 1n,
        name: input.name?.trim() || "CI token",
        tokenHash
      }
    });
    return {
      data: {
        id: created.id,
        projectId: created.projectId ?? projectId,
        name: created.name,
        lastUsedAt: created.lastUsedAt ? created.lastUsedAt.toISOString() : null
      },
      rawToken
    };
  }

  const row: TokenRow = {
    id: BigInt(Date.now()),
    projectId,
    name: input.name?.trim() || "CI token",
    lastUsedAt: null
  };
  tokens.unshift(row);
  return { data: row, rawToken: "tok_live_demo_only" };
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

  const index = tokens.findIndex((item) => item.projectId === projectId && item.id === tokenId);
  if (index < 0) {
    throw new AppError("NOT_FOUND", "token not found", 404);
  }
  tokens.splice(index, 1);
}

export async function registerTokensRoutes(app: FastifyInstance, deps: { prisma?: PrismaClient }) {
  app.get("/api/projects/:projectId/tokens", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const rows = await listProjectTokens(projectId, deps.prisma);
    return reply.send(toJsonSafe(paged(rows, 1, 100)));
  });

  app.post("/api/projects/:projectId/tokens", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = createTokenBodySchema.parse(req.body ?? {});
    const created = await createProjectToken(projectId, body, deps.prisma);
    return reply.send(toJsonSafe(created));
  });

  app.delete("/api/projects/:projectId/tokens/:tokenId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { tokenId: string };
    const tokenId = BigInt(params.tokenId);
    await revokeProjectToken(projectId, tokenId, deps.prisma);
    return reply.status(204).send();
  });

  app.get("/api/tokens", async (req, reply) => {
    const { projectId } = compatProjectIdSchema.parse(req.query ?? {});
    const rows = await listProjectTokens(projectId, deps.prisma);
    return reply.send(toJsonSafe(paged(rows, 1, 100)));
  });

  app.post("/api/tokens", async (req, reply) => {
    const parsed = z
      .object({ projectId: z.coerce.bigint(), name: z.string().optional() })
      .parse(req.body ?? {});
    const created = await createProjectToken(parsed.projectId, { name: parsed.name }, deps.prisma);
    return reply.send(toJsonSafe(created));
  });

  app.delete("/api/tokens/:tokenId", async (req, reply) => {
    const params = req.params as { tokenId: string };
    const { projectId } = compatProjectIdSchema.parse(req.query ?? {});
    await revokeProjectToken(projectId, BigInt(params.tokenId), deps.prisma);
    return reply.status(204).send();
  });
}
