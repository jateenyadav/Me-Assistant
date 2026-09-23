/** User-facing shapes shared across clients. Never includes secrets. */

export type UserRole = "user" | "admin";

/** Profile fields the diet/workout/AI layers reason over (Section 7.2). */
export interface UserProfile {
  heightCm?: number;
  weightKg?: number;
  goal?: string;
}

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
