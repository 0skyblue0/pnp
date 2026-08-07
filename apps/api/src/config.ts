import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const corsOriginSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const origins = value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    return origins.length > 1 ? origins : origins[0];
  },
  z.union([z.string().min(1), z.array(z.string().min(1))]).default("http://localhost:5173")
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  BOOTSTRAP_USERNAME: z.string().min(1).optional(),
  BOOTSTRAP_PASSWORD_HASH: z.string().min(20).optional(),
  CORS_ORIGIN: corsOriginSchema,
  HERMES_API_BASE_URL: z.string().url().optional(),
  HERMES_API_KEY: optionalNonEmptyString,
  HERMES_API_MODEL: z.string().min(1).default("pnpclassifier"),
  HERMES_API_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: optionalNonEmptyString
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config = envSchema.parse(env);

  if (config.NODE_ENV === "production" && !config.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production");
  }

  return config;
}
