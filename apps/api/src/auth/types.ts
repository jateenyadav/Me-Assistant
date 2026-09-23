/** Shared auth types — imported by guard, strategy, service, and controller. */

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

/** The validated principal attached to req.user by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
  role: string;
}
