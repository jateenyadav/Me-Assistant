import { createHash, randomBytes } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { UsersService } from "../users/users.service";
import { McpToken, McpTokenDocument } from "./mcp-token.schema";

@Injectable()
export class McpService {
  constructor(
    @InjectModel(McpToken.name) private readonly tokens: Model<McpTokenDocument>,
    private readonly users: UsersService,
  ) {}

  async settings(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return { enabled: user.mcpEnabled === true };
  }

  async setEnabled(userId: string, enabled: boolean) {
    const user = await this.users.updateMcpEnabled(userId, enabled);
    if (!user) throw new UnauthorizedException();
    if (!enabled) await this.tokens.updateMany({ userId: new Types.ObjectId(userId), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }).exec();
    return { enabled: user.mcpEnabled };
  }

  async createToken(userId: string, label: string, scopes: ("read" | "write")[]) {
    if (!(await this.settings(userId)).enabled) throw new ForbiddenException("Enable MCP access first");
    const token = `mcp_${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const record = await this.tokens.create({ userId: new Types.ObjectId(userId), label, scopes,
      tokenHash: this.hash(token), expiresAt });
    return { id: record._id.toString(), token, label, scopes, expiresAt: expiresAt.toISOString() };
  }

  async listTokens(userId: string) {
    const records = await this.tokens.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(100).exec();
    return records.map((record) => ({ id: record._id.toString(), label: record.label,
      scopes: record.scopes, expiresAt: record.expiresAt.toISOString(), revoked: Boolean(record.revokedAt) }));
  }

  async revoke(userId: string, id: string) {
    if (!/^[a-f0-9]{24}$/.test(id)) throw new NotFoundException("Token not found");
    const token = await this.tokens.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }, { returnDocument: "after" },
    ).exec();
    if (!token) throw new NotFoundException("Token not found");
  }

  async authenticate(header: string | undefined) {
    const match = /^Bearer (mcp_[A-Za-z0-9_-]{43})$/.exec(header ?? "");
    if (!match) throw new UnauthorizedException("MCP token required");
    const record = await this.tokens.findOne({ tokenHash: this.hash(match[1]),
      revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).exec();
    if (!record || !(await this.settings(record.userId.toString())).enabled) throw new UnauthorizedException("MCP token invalid or access disabled");
    return { userId: record.userId.toString(), scopes: record.scopes };
  }

  private hash(token: string) { return createHash("sha256").update(token).digest("hex"); }
}
