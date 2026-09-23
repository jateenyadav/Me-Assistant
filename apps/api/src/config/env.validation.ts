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
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
}).superRefine((env, context) => {
  const configured = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI];
  if (configured.some(Boolean) && !configured.every(Boolean)) {
    context.addIssue({ code: "custom", message: "Google sign-in needs client ID, secret, and redirect URI" });
  }
  if (env.GOOGLE_REDIRECT_URI && new URL(env.GOOGLE_REDIRECT_URI).pathname !== "/auth/google/callback") {
    context.addIssue({ code: "custom", message: "Google redirect URI must end in /auth/google/callback" });
  }
  if (env.GOOGLE_REDIRECT_URI) {
    const redirect = new URL(env.GOOGLE_REDIRECT_URI);
    if (redirect.username || redirect.password || redirect.search || redirect.hash ||
      (redirect.protocol !== "https:" && !(redirect.protocol === "http:" && redirect.hostname === "localhost"))) {
      context.addIssue({ code: "custom", message: "Google redirect URI must be HTTPS (or localhost HTTP), without credentials or query" });
    }
  }
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
