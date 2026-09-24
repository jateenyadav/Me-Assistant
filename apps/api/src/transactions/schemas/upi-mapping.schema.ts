import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import type { PublicTransaction } from "@lifeos/shared";

export type UpiMappingDocument = HydratedDocument<UpiMapping>;

@Schema({ timestamps: true })
export class UpiMapping {
  @Prop({ type: Types.ObjectId, required: true, ref: "User" })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  upiHash!: string;

  @Prop({ type: String, required: true, enum: ["expense", "income"] })
  type!: PublicTransaction["type"];

  @Prop({ type: String, required: true, enum: ["food", "shopping", "transport", "bills", "health", "other"] })
  category!: PublicTransaction["category"];
}

export const UpiMappingSchema = SchemaFactory.createForClass(UpiMapping);
UpiMappingSchema.index({ userId: 1, upiHash: 1, type: 1 }, { unique: true });
