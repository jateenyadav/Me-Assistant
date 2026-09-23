import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import type { PublicTransaction } from "@lifeos/shared";

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, required: true, ref: "User" })
  userId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  amountMinor!: number;

  @Prop({ type: String, required: true, enum: ["expense", "income"] })
  type!: PublicTransaction["type"];

  @Prop({ type: String, required: true, enum: ["food", "shopping", "transport", "bills", "health", "other"] })
  category!: PublicTransaction["category"];

  @Prop({ type: String, maxlength: 140 })
  note?: string;

  @Prop({ type: Date, required: true })
  occurredAt!: Date;

  @Prop({ type: String, required: true, default: "INR", enum: ["INR"] })
  currency!: "INR";

  @Prop({ type: String, required: true, default: "manual", enum: ["manual"] })
  source!: "manual";

  createdAt!: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ userId: 1, occurredAt: -1, _id: -1 });

export function toPublicTransaction(doc: TransactionDocument): PublicTransaction {
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
