import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("allows comma-separated CORS origins for http and https access", () => {
    const config = loadConfig({
      NODE_ENV: "development",
      CORS_ORIGIN: "http://localhost:5173, https://localhost:5173, https://127.0.0.1:5173"
    });

    expect(config.CORS_ORIGIN).toEqual([
      "http://localhost:5173",
      "https://localhost:5173",
      "https://127.0.0.1:5173"
    ]);
  });

  it("keeps a single CORS origin as a string", () => {
    const config = loadConfig({
      NODE_ENV: "development",
      CORS_ORIGIN: "https://localhost:5173"
    });

    expect(config.CORS_ORIGIN).toBe("https://localhost:5173");
  });
});
