import { z } from "zod";

/** User-facing shapes shared across clients. Never includes secrets. */

export type UserRole = "user" | "admin";

/** Profile fields the diet/workout/AI layers reason over (Section 7.2). */
export interface UserProfile {
  heightCm?: number;
  weightKg?: number;
  goal?: string;
}

export const updateProfileSchema = z.strictObject({
  heightCm: z.number().finite().min(50).max(280).optional(),
  weightKg: z.number().finite().min(10).max(500).optional(),
  goal: z.string().trim().max(500).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

/** Safe user representation returned by the API — no passwordHash, ever. */
export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}
