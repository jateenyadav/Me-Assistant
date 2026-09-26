import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type McpTokenDocument = HydratedDocument<McpToken>;

@Schema({ timestamps: true })
export class McpToken {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, ref: "User" })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: String, required: true, maxlength: 60 })
  label!: string;

  @Prop({ type: [String], required: true, enum: ["read", "write"] })
  scopes!: ("read" | "write")[];

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date })
  revokedAt?: Date;

  createdAt!: Date;
}

export const McpTokenSchema = SchemaFactory.createForClass(McpToken);
McpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
McpTokenSchema.index({ userId: 1, createdAt: -1 });
