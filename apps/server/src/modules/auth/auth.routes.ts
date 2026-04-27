import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).optional()
});

function getBearerToken(value?: string): string | undefined {
  if (!value) return undefined;
  const [scheme, token] = value.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

export async function registerAuthRoutes(app: FastifyInstance, deps: { authService: AuthService }) {
  app.post("/api/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const result = await deps.authService.login(body.email);
    return reply.send(toJsonSafe(result));
  });

  app.get("/api/auth/me", async (req, reply) => {
    const token = getBearerToken(req.headers.authorization);
    const user = await deps.authService.me(token);
    if (!user) return reply.code(401).send({ code: "UNAUTHORIZED", message: "invalid auth token" });
    const memberships = await deps.authService.listMemberships(user.id);
    return reply.send(toJsonSafe({ user, memberships }));
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = getBearerToken(req.headers.authorization);
    await deps.authService.logout(token);
    return reply.code(204).send();
  });
}
