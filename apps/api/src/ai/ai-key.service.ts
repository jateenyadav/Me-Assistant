import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AiKey, AiKeyDocument } from "./ai-key.schema";

export type AiProvider = "bedrock" | "openai" | "anthropic" | "google";
export type ByokProvider = Exclude<AiProvider, "bedrock">;

@Injectable()
export class AiKeyService {
  constructor(@InjectModel(AiKey.name) private readonly keys: Model<AiKeyDocument>, private readonly config: ConfigService) {}

  private masterKey(): Buffer {
    const encoded = this.config.get<string>("AI_ENCRYPTION_KEY");
    if (!encoded) throw new ServiceUnavailableException("AI key encryption is not configured");
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) throw new ServiceUnavailableException("AI key encryption is misconfigured");
    return key;
  }

  async save(userId: string, provider: ByokProvider, secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey(), iv);
    cipher.setAAD(Buffer.from(`lifeos-ai-key:v1:${userId}:${provider}`));
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const selector = { userId: new Types.ObjectId(userId), provider };
    const update = { $set: { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"), keyVersion: 1 } };
    try {
      await this.keys.updateOne(selector, update, { upsert: true }).exec();
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) throw error;
      await this.keys.updateOne(selector, update).exec();
    }
    return { provider, configured: true };
  }

  async list(userId: string) {
    const records = await this.keys.find({ userId: new Types.ObjectId(userId) }).select("provider").exec();
    return records.map((record) => ({ provider: record.provider, configured: true }));
  }

  async remove(userId: string, provider: ByokProvider) {
    await this.keys.deleteOne({ userId: new Types.ObjectId(userId), provider }).exec();
  }

  async read(userId: string, provider: ByokProvider): Promise<string | null> {
    const record = await this.keys.findOne({ userId: new Types.ObjectId(userId), provider }).exec();
    if (!record) return null;
    if (record.keyVersion !== 1) throw new ServiceUnavailableException("Unsupported AI key version");
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.masterKey(), Buffer.from(record.iv, "base64"));
      decipher.setAAD(Buffer.from(`lifeos-ai-key:v1:${userId}:${provider}`));
      decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]).toString("utf8");
    } catch { throw new ServiceUnavailableException("AI key could not be decrypted"); }
  }
}
