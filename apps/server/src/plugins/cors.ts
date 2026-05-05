import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

import { env } from "../config/env.js";

export function registerCors(app: FastifyInstance) {
  app.register(cors, { origin: env.webOrigin });
}
