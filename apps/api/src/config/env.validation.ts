import { z } from "zod";

/**
 * Fail fast on boot if the environment is misconfigured. A missing JWT secret
 * or DB URI should crash at startup, not silently at the first request.
 */
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  // Refresh tokens are opaque + hashed at rest (not JWTs), so no signing secret
  // is needed — only their lifetime.
  JWT_REFRESH_TTL: z.string().default("7d"),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}
