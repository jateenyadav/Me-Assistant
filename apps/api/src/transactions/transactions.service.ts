import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import type { CreateTransactionDto, PublicTransaction } from "@lifeos/shared";
import { Transaction, TransactionDocument, toPublicTransaction } from "./schemas/transaction.schema";

@Injectable()
export class TransactionsService {
  constructor(@InjectModel(Transaction.name) private readonly transactions: Model<TransactionDocument>) {}

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

  async list(userId: string): Promise<PublicTransaction[]> {
    const transactions = await this.transactions
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(50)
      .exec();
    return transactions.map(toPublicTransaction);
  }
}
