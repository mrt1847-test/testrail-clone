import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";

type TokenRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  lastUsedAt: string | null;
};

const tokens: TokenRow[] = [];

export async function registerTokensRoutes(app: FastifyInstance, deps: { prisma?: PrismaClient }) {
  app.get("/api/projects/:projectId/tokens", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.apiToken.findMany({
        where: { projectId, revokedAt: null },
        orderBy: { id: "desc" },
        take: 100
      });
      return reply.send(
        toJsonSafe(
          paged(
            rows.map((row: (typeof rows)[number]) => ({
              id: row.id,
              projectId: row.projectId ?? projectId,
              name: row.name,
              lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null
            })),
            1,
            100
          )
        )
      );
    }
    return reply.send(toJsonSafe(paged(tokens.filter((item) => item.projectId === projectId), 1, 100)));
  });

  app.post("/api/projects/:projectId/tokens", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = req.body as { name?: string };
    if (deps.prisma) {
      const rawToken = `tok_${randomBytes(16).toString("hex")}`;
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const created = await deps.prisma.apiToken.create({
        data: {
          projectId,
          userId: 1n,
          name: body.name?.trim() || "CI token",
          tokenHash
        }
      });
      return reply.send(
        toJsonSafe({
          data: {
            id: created.id,
            projectId: created.projectId ?? projectId,
            name: created.name,
            lastUsedAt: created.lastUsedAt ? created.lastUsedAt.toISOString() : null
          },
          rawToken
        })
      );
    }
    const row: TokenRow = {
      id: BigInt(Date.now()),
      projectId,
      name: body.name?.trim() || "CI token",
      lastUsedAt: null
    };
    tokens.unshift(row);
    return reply.send(toJsonSafe({ data: row, rawToken: "tok_live_demo_only" }));
  });

  app.delete("/api/projects/:projectId/tokens/:tokenId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { tokenId: string };
    const tokenId = BigInt(params.tokenId);
    if (deps.prisma) {
      const row = await deps.prisma.apiToken.findFirst({
        where: { id: tokenId, projectId, revokedAt: null },
        select: { id: true }
      });
      if (!row) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "token not found" });
      }
      await deps.prisma.apiToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() }
      });
      return reply.status(204).send();
    }
    const index = tokens.findIndex((item) => item.projectId === projectId && item.id === tokenId);
    if (index < 0) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "token not found" });
    }
    tokens.splice(index, 1);
    return reply.status(204).send();
  });
}
