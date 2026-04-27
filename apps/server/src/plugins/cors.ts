import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

import { env } from "../config/env.js";

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, { origin: env.webOrigin });
}
