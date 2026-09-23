import { createHash, randomBytes } from "node:crypto";
import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { Model } from "mongoose";
import type { AuthResponse } from "@lifeos/shared";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import { GoogleAuthAttempt, GoogleAuthAttemptDocument, GoogleLoginTicket } from "./schemas/google-auth-attempt.schema";

const ATTEMPT_MS = 5 * 60 * 1000;
const TICKET_MS = 60 * 1000;

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    @InjectModel(GoogleAuthAttempt.name) private readonly attempts: Model<GoogleAuthAttemptDocument>,
    @InjectModel(GoogleLoginTicket.name) private readonly tickets: Model<GoogleLoginTicket>,
  ) {}

  private client(): OAuth2Client {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET");
    const redirectUri = this.config.get<string>("GOOGLE_REDIRECT_URI");
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException("Google sign-in is not configured");
    }
    return new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  async begin(clientState: string): Promise<{ url: string; state: string }> {
    const client = this.client();
    const state = randomBytes(32).toString("hex");
    const nonce = randomBytes(32).toString("hex");
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    await this.attempts.create({ state, clientState, codeVerifier, nonce, expiresAt: new Date(Date.now() + ATTEMPT_MS) });
    return {
      state,
      url: client.generateAuthUrl({
        scope: ["openid", "email"],
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
        prompt: "select_account",
      }),
    };
  }

  async complete(code: string, state: string, cookieState: string): Promise<string> {
    if (!state || !cookieState || state !== cookieState || !code) {
      throw new UnauthorizedException("Invalid Google sign-in request");
    }
    const attempt = await this.attempts.findOneAndDelete({ state, expiresAt: { $gt: new Date() } }).exec();
    if (!attempt) throw new UnauthorizedException("Google sign-in expired or already used");

    const client = this.client();
    let payload;
    try {
      const { tokens } = await client.getToken({ code, codeVerifier: attempt.codeVerifier });
      if (!tokens.id_token) throw new Error("Missing identity token");
      const verified = await client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.getOrThrow<string>("GOOGLE_CLIENT_ID") });
      payload = verified.getPayload();
    } catch {
      throw new UnauthorizedException("Google sign-in could not be verified");
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true || payload.nonce !== attempt.nonce) {
      throw new UnauthorizedException("Invalid Google identity");
    }
    const user = await this.users.findOrCreateGoogle(payload.sub, payload.email);
    const ticket = randomBytes(32).toString("hex");
    await this.tickets.create({
      ticketHash: createHash("sha256").update(ticket).digest("hex"),
      userId: user._id,
      expiresAt: new Date(Date.now() + TICKET_MS),
    });
    const destination = new URL("/auth/google/complete", this.config.getOrThrow<string>("WEB_ORIGIN"));
    destination.hash = new URLSearchParams({ ticket, state: attempt.clientState }).toString();
    return destination.toString();
  }

  async exchange(ticket: string): Promise<AuthResponse> {
    if (!/^[a-f0-9]{64}$/.test(ticket)) throw new UnauthorizedException("Invalid Google login ticket");
    const ticketHash = createHash("sha256").update(ticket).digest("hex");
    const record = await this.tickets.findOneAndDelete({ ticketHash, expiresAt: { $gt: new Date() } }).exec();
    if (!record) throw new UnauthorizedException("Google login ticket expired or already used");
    return this.auth.issueForUserId(record.userId.toString());
  }
}
