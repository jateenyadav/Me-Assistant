import { createHmac } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import type { CreateTransactionDto, ImportEmailDto, ImportNotificationDto, PendingNotification, PublicTransaction } from "@lifeos/shared";
import { Transaction, TransactionDocument, toPendingNotification, toPublicTransaction } from "./schemas/transaction.schema";
import { UpiMapping, UpiMappingDocument } from "./schemas/upi-mapping.schema";
import { parseEmailPayment } from "./email-payment.parser";

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private readonly transactions: Model<TransactionDocument>,
    @InjectModel(UpiMapping.name) private readonly mappings: Model<UpiMappingDocument>,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string, input: CreateTransactionDto): Promise<PublicTransaction> {
    const transaction = await this.transactions.create({
      ...input,
      userId: new Types.ObjectId(userId),
      occurredAt: new Date(input.occurredAt),
      currency: "INR",
      source: "manual",
    });
    return toPublicTransaction(transaction);
  }

  previewEmail(text: string) {
    const payment = parseEmailPayment(text);
    if (!payment) throw new BadRequestException("Could not confidently identify one completed INR payment; enter it manually instead");
    return payment;
  }

  async importEmail(userId: string, input: ImportEmailDto): Promise<PublicTransaction> {
    const payment = this.previewEmail(input.text);
    const owner = new Types.ObjectId(userId);
    const sourceEventId = createHmac("sha256", this.config.getOrThrow<string>("JWT_ACCESS_SECRET"))
      .update(`finance-email:v1:${userId}:${input.occurredAt}:${input.text.trim().replace(/\s+/g, " ").toLowerCase()}`).digest("hex");
    const selector = { userId: owner, source: "email_paste" as const, sourceEventId };
    let transaction: TransactionDocument | null;
    try {
      transaction = await this.transactions.findOneAndUpdate(selector, {
        $setOnInsert: { ...selector, ...payment, category: input.category, occurredAt: new Date(input.occurredAt), currency: "INR" },
      }, { upsert: true, returnDocument: "after" }).exec();
    } catch (error) {
      if (!this.isDuplicateKey(error)) throw error;
      transaction = await this.transactions.findOne(selector).exec();
      if (!transaction) throw error;
    }
    if (!transaction) throw new Error("Email import returned no transaction");
    if (transaction.amountMinor !== payment.amountMinor || transaction.type !== payment.type ||
      transaction.category !== input.category || transaction.occurredAt.getTime() !== new Date(input.occurredAt).getTime()) {
      throw new ConflictException("This email was already imported with different details");
    }
    return toPublicTransaction(transaction);
  }

  async list(userId: string): Promise<PublicTransaction[]> {
    const transactions = await this.transactions
      .find({ userId: new Types.ObjectId(userId), category: { $exists: true } })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(50)
      .exec();
    return transactions.map(toPublicTransaction);
  }

  async pending(userId: string): Promise<PendingNotification[]> {
    const transactions = await this.transactions
      .find({ userId: new Types.ObjectId(userId), source: "android_notification", category: { $exists: false } })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(50)
      .exec();
    return transactions.map(toPendingNotification);
  }

  async importNotification(userId: string, input: ImportNotificationDto) {
    const owner = new Types.ObjectId(userId);
    const selector = { userId: owner, source: "android_notification" as const, sourceEventId: input.eventId };
    const upiHash = input.upiId ? this.hashUpi(userId, input.upiId) : undefined;
    const mapping = upiHash ? await this.mappings.findOne({ userId: owner, upiHash, type: input.type }).exec() : null;
    let transaction: TransactionDocument | null;
    try {
      transaction = await this.transactions.findOneAndUpdate(selector, {
        $setOnInsert: {
          ...selector,
          amountMinor: input.amountMinor,
          type: input.type,
          occurredAt: new Date(input.occurredAt),
          currency: "INR",
          ...(upiHash ? { upiHash } : {}),
          ...(mapping ? { category: mapping.category } : {}),
        },
      }, { upsert: true, returnDocument: "after" }).exec();
    } catch (error) {
      if (!this.isDuplicateKey(error)) throw error;
      const existing = await this.transactions.findOne(selector).exec();
      if (!existing) throw error;
      transaction = existing;
    }
    if (!transaction) throw new Error("Notification import returned no transaction");
    if (transaction.amountMinor !== input.amountMinor || transaction.type !== input.type ||
      transaction.occurredAt.getTime() !== new Date(input.occurredAt).getTime() || transaction.upiHash !== upiHash) {
      throw new ConflictException("Notification event ID was already used for different data");
    }
    return transaction.category
      ? { status: "categorized" as const, transaction: toPublicTransaction(transaction) }
      : { status: "pending" as const, notification: toPendingNotification(transaction) };
  }

  async categorize(userId: string, id: string, category: PublicTransaction["category"]): Promise<PublicTransaction> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid notification ID");
    const owner = new Types.ObjectId(userId);
    const selector = { _id: new Types.ObjectId(id), userId: owner, source: "android_notification" as const };
    const transaction = await this.transactions.findOneAndUpdate(
      { ...selector, category: { $exists: false } },
      { $set: { category } },
      { returnDocument: "after" },
    ).exec();
    const existing = transaction ?? await this.transactions.findOne(selector).exec();
    if (!existing) throw new NotFoundException("Notification not found");
    if (existing.category !== category) throw new ConflictException("Notification was already categorized differently");
    if (existing.upiHash) {
      await this.mappings.updateOne(
        { userId: owner, upiHash: existing.upiHash, type: existing.type },
        { $set: { category }, $setOnInsert: { userId: owner, upiHash: existing.upiHash, type: existing.type } },
        { upsert: true },
      ).exec();
    }
    return toPublicTransaction(existing);
  }

  private hashUpi(userId: string, upiId: string): string {
    return createHmac("sha256", this.config.getOrThrow<string>("JWT_ACCESS_SECRET"))
      .update(`finance-upi:v1:${userId}:${upiId.toLowerCase()}`).digest("hex");
  }

  private isDuplicateKey(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
  }
}
