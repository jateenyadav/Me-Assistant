import { z } from "zod";

/**
 * Auth DTOs — the single source of truth shared by the NestJS API (request
 * validation) and the Next.js web app (form validation). One schema, one shape,
 * validated identically on both ends.
 */

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshDto = z.infer<typeof refreshSchema>;

export const logoutSchema = refreshSchema;
export type LogoutDto = z.infer<typeof logoutSchema>;

/** Response returned on register/login. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
