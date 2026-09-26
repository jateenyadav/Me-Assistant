import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import type { LifeKind, LifePayload } from "@lifeos/shared";

export type LifeRecordDocument = HydratedDocument<LifeRecord>;

@Schema({ timestamps: true })
export class LifeRecord {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ["food", "workout", "medication", "medication-intake", "note", "reminder", "goal"] })
  kind!: LifeKind;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload!: LifePayload;

  @Prop({ type: Date, required: true })
  occurredAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LifeRecordSchema = SchemaFactory.createForClass(LifeRecord);
LifeRecordSchema.index({ userId: 1, kind: 1, occurredAt: -1, _id: -1 });

export function toPublicLifeEntry(record: LifeRecordDocument) {
  return {
    id: record._id.toString(), kind: record.kind, payload: record.payload,
    createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
  };
}
