import { randomBytes } from "node:crypto";
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as bcrypt from "bcrypt";
import type { AuthResponse } from "@lifeos/shared";
import { UsersService } from "../users/users.service";
import { toPublicUser, UserDocument } from "../users/schemas/user.schema";
import { parseDurationMs } from "../common/duration";
import { RefreshToken, RefreshTokenDocument } from "./schemas/refresh-token.schema";
import type { AccessTokenPayload } from "./types";

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokens: Model<RefreshTokenDocument>,
  ) {}

  async register(email: string, password: string): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException("Email already registered");
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create(email, passwordHash);
    return this.issueTokens(user);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    // Compare even on missing user to blunt timing-based user enumeration.
    const ok = await bcrypt.compare(
      password,
      user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinv",
    );
    if (!user?.passwordHash || !ok) throw new UnauthorizedException("Invalid credentials");
    return this.issueTokens(user);
  }

  /** Rotate: verify the presented token, revoke it, issue a fresh pair. */
  async refresh(rawToken: string): Promise<AuthResponse> {
    const { jti, secret } = this.splitRefreshToken(rawToken);
    const doc = await this.refreshTokens.findOne({ jti }).exec();
    if (!doc) throw new UnauthorizedException("Invalid refresh token");

    const matches = await bcrypt.compare(secret, doc.tokenHash);
    if (!matches) throw new UnauthorizedException("Invalid refresh token");

    // Revoked token reused ⇒ likely theft: nuke every token for this user.
    if (doc.revoked) {
      await this.revokeAllForUser(doc.userId);
      this.logger.warn(`Refresh token reuse detected for user ${doc.userId.toString()}`);
      throw new UnauthorizedException("Refresh token reuse detected");
    }
    if (doc.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Refresh token expired");
    }
    const claimed = await this.refreshTokens.findOneAndUpdate(
      { _id: doc._id, revoked: false, expiresAt: { $gt: new Date() } },
      { $set: { revoked: true } },
    ).exec();
    if (!claimed) throw new UnauthorizedException("Refresh token already used or expired");

    const user = await this.users.findById(doc.userId.toString());
    if (!user) throw new UnauthorizedException("User no longer exists");
    return this.issueTokens(user);
  }

  async logout(rawToken: string): Promise<void> {
    const { jti, secret } = this.splitRefreshToken(rawToken);
    const doc = await this.refreshTokens.findOne({ jti }).exec();
    if (!doc || !(await bcrypt.compare(secret, doc.tokenHash))) return;
    await this.refreshTokens.updateOne({ _id: doc._id, revoked: false }, { $set: { revoked: true } }).exec();
  }

  async issueForUserId(userId: string): Promise<AuthResponse> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException("User no longer exists");
    return this.issueTokens(user);
  }

  // --- internals ---

  private async issueTokens(user: UserDocument): Promise<AuthResponse> {
    const payload: AccessTokenPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      // jsonwebtoken types expiresIn as a branded StringValue; our validated
      // config value ("15m") is a plain string, so cast at this boundary.
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m") as `${number}${"m" | "h" | "d" | "s"}`,
    });
    const refreshToken = await this.createRefreshToken(user._id);
    return { user: toPublicUser(user), accessToken, refreshToken };
  }

  private async createRefreshToken(userId: Types.ObjectId): Promise<string> {
    const jti = randomBytes(16).toString("hex");
    const secret = randomBytes(32).toString("hex"); // 64 chars < bcrypt's 72-byte limit
    const tokenHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);
    const ttlMs = parseDurationMs(this.config.get<string>("JWT_REFRESH_TTL", "7d"));
    await this.refreshTokens.create({
      userId,
      jti,
      tokenHash,
      expiresAt: new Date(Date.now() + ttlMs),
      revoked: false,
    });
    return `${jti}.${secret}`;
  }

  private splitRefreshToken(raw: string): { jti: string; secret: string } {
    const match = /^([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(raw);
    if (!match) throw new UnauthorizedException("Malformed refresh token");
    return { jti: match[1], secret: match[2] };
  }

  private async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await this.refreshTokens.updateMany({ userId, revoked: false }, { revoked: true }).exec();
  }
}
