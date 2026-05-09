import { randomBytes } from "node:crypto";

import type { FastifyInstance, FastifyReply } from "fastify";

import { HttpError } from "../http.js";

const csrfCookieName = "pnp_csrf";
const csrfHeaderName = "x-csrf-token";
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const csrfExemptPaths = new Set(["/api/v1/auth/csrf", "/api/v1/auth/login"]);

export function attachCsrfProtection(app: FastifyInstance): void {
  app.addHook("preHandler", async (request) => {
    if (!unsafeMethods.has(request.method) || csrfExemptPaths.has(request.url)) {
      return;
    }

    const headerValue = request.headers[csrfHeaderName];
    const tokenFromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const tokenFromCookie = request.cookies[csrfCookieName];

    if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
      throw new HttpError(403, "CSRF_TOKEN_INVALID", "A valid CSRF token is required");
    }
  });
}

export function issueCsrfToken(reply: FastifyReply, secure: boolean): string {
  const token = randomBytes(32).toString("hex");
  reply.setCookie(csrfCookieName, token, {
    httpOnly: true,
    maxAge: 8 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure
  });
  return token;
}
