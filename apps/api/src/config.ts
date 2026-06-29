import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  BOOTSTRAP_USERNAME: z.string().min(1).optional(),
  BOOTSTRAP_PASSWORD_HASH: z.string().min(20).optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  HERMES_API_BASE_URL: z.string().url().optional(),
  HERMES_API_KEY: optionalNonEmptyString,
  HERMES_API_MODEL: z.string().min(1).default("pnp-response-classifier"),
  HERMES_API_TIMEOUT_MS: z.coerce.number().int().positive().default(60000)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = envSchema.parse(env);

  if (config.NODE_ENV === "production" && !config.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production");
  }

  return config;
}
