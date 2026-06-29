import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app.js";

describe("healthz", () => {
  it("returns the API envelope", async () => {
    const app = await buildServer({
      config: {
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: 0,
        DATABASE_URL: "postgresql://test:***@localhost:5432/test",
        CORS_ORIGIN: "http://localhost:5173",
        HERMES_API_MODEL: "pnp-response-classifier",
        HERMES_API_TIMEOUT_MS: 60000
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/healthz"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: { status: "ok" },
      error: null
    });

    await app.close();
  });
});
