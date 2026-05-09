import type { FastifyReply } from "fastify";
import { fail, ok } from "@pnp/shared";

export class HttpError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function sendOk<T>(reply: FastifyReply, data: T, statusCode = 200): FastifyReply {
  return reply.status(statusCode).send(ok(data));
}

export function sendError(reply: FastifyReply, error: HttpError): FastifyReply {
  return reply.status(error.statusCode).send(
    fail({
      code: error.code,
      message: error.message,
      details: error.details
    })
  );
}
