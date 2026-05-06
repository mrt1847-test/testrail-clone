import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

import { env } from "../config/env.js";

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
    origin: env.webOrigin,
    methods: [...CORS_METHODS],
  });
}
