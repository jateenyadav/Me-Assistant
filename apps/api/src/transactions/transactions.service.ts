import { createHmac } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { transactionCategories, type CreateTransactionDto, type FinanceSummary, type FinanceTrend, type ImportEmailDto, type ImportNotificationDto, type PendingNotification, type PublicTransaction, type TransactionPage } from "@lifeos/shared";
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

  async list(userId: string, cursor?: string): Promise<TransactionPage> {
    const after = cursor ? this.decodeCursor(cursor) : null;
    const transactions = await this.transactions
      .find({
        userId: new Types.ObjectId(userId), category: { $exists: true },
        ...(after ? { $or: [
          { occurredAt: { $lt: after.occurredAt } },
          { occurredAt: after.occurredAt, _id: { $lt: after.id } },
        ] } : {}),
      })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(51)
      .exec();
    const page = transactions.slice(0, 50);
    const last = page.at(-1);
    return {
      transactions: page.map(toPublicTransaction),
      nextCursor: transactions.length > 50 && last
        ? Buffer.from(JSON.stringify([last.occurredAt.toISOString(), last._id.toString()])).toString("base64url")
        : null,
    };
  }

  async trend(userId: string, to = new Date()): Promise<FinanceTrend> {
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1));
    const months = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + index, 1)).toISOString().slice(0, 7);
      return { month, expenseMinor: 0, incomeMinor: 0 };
    });
    const byMonth = new Map(months.map((month) => [month.month, month]));
    const groups = await this.transactions.aggregate<{
      _id: { month: Date; type: PublicTransaction["type"] };
      totalMinor: { toString(): string };
    }>([
      { $match: { userId: new Types.ObjectId(userId), category: { $exists: true }, occurredAt: { $gte: from, $lte: to } } },
      { $group: { _id: { month: { $dateTrunc: { date: "$occurredAt", unit: "month", timezone: "UTC" } }, type: "$type" },
        totalMinor: { $sum: { $toDecimal: "$amountMinor" } } } },
    ]).exec();
    for (const group of groups) {
      const month = byMonth.get(group._id.month.toISOString().slice(0, 7));
      if (!month || (group._id.type !== "expense" && group._id.type !== "income")) {
        throw new InternalServerErrorException("Invalid finance trend group");
      }
      const amountMinor = this.safeMinor(group.totalMinor);
      const key = group._id.type === "expense" ? "expenseMinor" : "incomeMinor";
      month[key] += amountMinor;
      if (!Number.isSafeInteger(month[key])) throw new InternalServerErrorException("Finance total exceeds supported range");
    }
    return { months };
  }

  async summary(userId: string, to = new Date()): Promise<FinanceSummary> {
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const groups = await this.transactions.aggregate<{
      _id: { type: PublicTransaction["type"]; category: PublicTransaction["category"] };
      totalMinor: { toString(): string };
    }>([
      { $match: { userId: new Types.ObjectId(userId), category: { $exists: true }, occurredAt: { $gte: from, $lte: to } } },
      { $group: { _id: { type: "$type", category: "$category" }, totalMinor: { $sum: { $toDecimal: "$amountMinor" } } } },
    ]).exec();
    const totals = { expenseMinor: 0, incomeMinor: 0 };
    const byCategory = new Map<PublicTransaction["category"], number>();
    for (const group of groups) {
      const amountMinor = this.safeMinor(group.totalMinor);
      if (group._id.type === "expense") {
        if (!transactionCategories.includes(group._id.category)) throw new InternalServerErrorException("Unknown finance category");
        byCategory.set(group._id.category, amountMinor);
        totals.expenseMinor += amountMinor;
      } else if (group._id.type === "income") {
        totals.incomeMinor += amountMinor;
      }
    }
    if (!Number.isSafeInteger(totals.expenseMinor) || !Number.isSafeInteger(totals.incomeMinor)) {
      throw new InternalServerErrorException("Finance total exceeds supported range");
    }
    return {
      from: from.toISOString(), to: to.toISOString(), ...totals,
      expenseByCategory: [...byCategory].map(([category, amountMinor]) => ({ category, amountMinor }))
        .sort((first, second) => second.amountMinor - first.amountMinor),
    };
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

  private decodeCursor(cursor: string): { occurredAt: Date; id: Types.ObjectId } {
    try {
      if (cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Invalid encoding");
      const decoded = Buffer.from(cursor, "base64url");
      if (decoded.toString("base64url") !== cursor) throw new Error("Invalid encoding");
      const value: unknown = JSON.parse(decoded.toString("utf8"));
      if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string" ||
        typeof value[1] !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value[0]) ||
        !/^[a-f0-9]{24}$/.test(value[1])) throw new Error("Invalid cursor");
      const occurredAt = new Date(value[0]);
      if (Number.isNaN(occurredAt.getTime()) || occurredAt.toISOString() !== value[0]) throw new Error("Invalid date");
      return { occurredAt, id: new Types.ObjectId(value[1]) };
    } catch {
      throw new BadRequestException("Invalid transaction cursor");
    }
  }

  private safeMinor(total: { toString(): string }): number {
    const raw = total.toString();
    const amountMinor = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(amountMinor)) throw new InternalServerErrorException("Finance total exceeds supported range");
    return amountMinor;
  }

  private isDuplicateKey(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
  }
}
