import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { HttpError, sendOk } from "../../common/http.js";
import { issueCsrfToken } from "../../common/security/csrf.js";

const loginBodySchema = z.object({
  username: z.string().min(1).max(40),
  password: z.string().min(1).max(200)
});

const sessionCookieName = "pnp_session";
const sessionTtlMs = 8 * 60 * 60 * 1000;

type SessionRecord = {
  username: string;
  expiresAt: number;
};

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const sessions = new Map<string, SessionRecord>();

  app.get("/csrf", async (_request, reply) => {
    const csrfToken = issueCsrfToken(reply, app.config.NODE_ENV === "production");
    return sendOk(reply, { csrfToken });
  });

  app.post("/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const username = app.config.BOOTSTRAP_USERNAME;
    const passwordHash = app.config.BOOTSTRAP_PASSWORD_HASH;

    if (!username || !passwordHash) {
      throw new HttpError(503, "AUTH_NOT_CONFIGURED", "Bootstrap credentials are not configured");
    }

    const isValid =
      body.username === username && (await bcrypt.compare(body.password, passwordHash));

    if (!isValid) {
      throw new HttpError(401, "AUTH_INVALID_CREDENTIALS", "Invalid credentials");
    }

    const sessionId = randomBytes(32).toString("hex");
    sessions.set(sessionId, {
      username,
      expiresAt: Date.now() + sessionTtlMs
    });

    reply.setCookie(sessionCookieName, sessionId, {
      httpOnly: true,
      maxAge: sessionTtlMs / 1000,
      path: "/",
      sameSite: "lax",
      secure: app.config.NODE_ENV === "production"
    });

    return sendOk(reply, { username });
  });

  app.post("/logout", async (request, reply) => {
    const sessionId = request.cookies[sessionCookieName];

    if (sessionId) {
      sessions.delete(sessionId);
    }

    reply.clearCookie(sessionCookieName, { path: "/" });
    return sendOk(reply, { loggedOut: true });
  });

  app.get("/me", async (request, reply) => {
    const sessionId = request.cookies[sessionCookieName];
    const session = sessionId ? sessions.get(sessionId) : undefined;

    if (!session || session.expiresAt <= Date.now()) {
      if (sessionId) {
        sessions.delete(sessionId);
      }
      throw new HttpError(401, "AUTH_SESSION_REQUIRED", "A valid session is required");
    }

    return sendOk(reply, { username: session.username });
  });
}
