import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

import { env } from "../config/env.js";
import { isAllowedWebOrigin } from "../config/webOrigins.js";

/** @fastify/cors v11+ defaults to CORS-safelisted methods only (GET, HEAD, POST). REST clients need PATCH/PUT/DELETE. */
const CORS_METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;

export function registerCors(app: FastifyInstance) {
  app.register(cors, {
    origin: (origin, cb) => {
      cb(null, isAllowedWebOrigin(origin, env.webOrigins));
    },
    methods: [...CORS_METHODS],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    maxAge: 86400
  });
}
