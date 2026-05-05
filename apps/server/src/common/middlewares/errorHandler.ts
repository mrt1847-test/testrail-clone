import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { AppError } from "../errors/appError.js";

export function handleRouteError(error: unknown, _req: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {})
      }
    });
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: "invalid request payload",
        details: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message
        }))
      }
    });
  }

  // eslint-disable-next-line no-console
  console.error(`Unhandled route error: ${_req.method} ${_req.url}`, error);

  return reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "unexpected server error"
    }
  });
}
