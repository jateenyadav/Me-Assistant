import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type AiKeyDocument = HydratedDocument<AiKey>;

@Schema({ timestamps: true })
export class AiKey {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ["openai", "anthropic", "google"] })
  provider!: "openai" | "anthropic" | "google";

  @Prop({ type: String, required: true })
  ciphertext!: string;

  @Prop({ type: String, required: true })
  iv!: string;

  @Prop({ type: String, required: true })
  authTag!: string;

  @Prop({ type: Number, required: true, default: 1 })
  keyVersion!: number;
}

export const AiKeySchema = SchemaFactory.createForClass(AiKey);
AiKeySchema.index({ userId: 1, provider: 1 }, { unique: true });
