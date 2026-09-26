import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import type { PendingNotification, PublicTransaction } from "@lifeos/shared";

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  userId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  amountMinor!: number;

  @Prop({ type: String, required: true, enum: ["expense", "income"] })
  type!: PublicTransaction["type"];

  @Prop({ type: String, enum: ["food", "shopping", "transport", "bills", "health", "other"] })
  category?: PublicTransaction["category"];

  @Prop({ type: String, maxlength: 140 })
  note?: string;

  @Prop({ type: Date, required: true })
  occurredAt!: Date;

  @Prop({ type: String, required: true, default: "INR", enum: ["INR"] })
  currency!: "INR";

  @Prop({ type: String, required: true, default: "manual", enum: ["manual", "android_notification", "email_paste"] })
  source!: PublicTransaction["source"];

  @Prop({ type: String })
  sourceEventId?: string;

  @Prop({ type: String })
  upiHash?: string;

  createdAt!: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ userId: 1, occurredAt: -1, _id: -1 });
TransactionSchema.index({ userId: 1, source: 1, sourceEventId: 1 }, { unique: true, partialFilterExpression: { sourceEventId: { $exists: true } } });

export function toPublicTransaction(doc: TransactionDocument): PublicTransaction {
  if (!doc.category) throw new Error("Cannot expose an uncategorized transaction");
  return {
    id: doc._id.toString(),
    amountMinor: doc.amountMinor,
    currency: doc.currency,
    type: doc.type,
    category: doc.category,
    note: doc.note,
    occurredAt: doc.occurredAt.toISOString(),
    source: doc.source,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toPendingNotification(doc: TransactionDocument): PendingNotification {
  return { id: doc._id.toString(), amountMinor: doc.amountMinor, type: doc.type, occurredAt: doc.occurredAt.toISOString() };
}
