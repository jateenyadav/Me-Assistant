import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type GoogleAuthAttemptDocument = HydratedDocument<GoogleAuthAttempt>;

@Schema()
export class GoogleAuthAttempt {
  @Prop({ required: true, unique: true })
  state!: string;

  @Prop({ required: true })
  clientState!: string;

  @Prop({ required: true })
  codeVerifier!: string;

  @Prop({ required: true })
  nonce!: string;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const GoogleAuthAttemptSchema = SchemaFactory.createForClass(GoogleAuthAttempt);
GoogleAuthAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema()
export class GoogleLoginTicket {
  @Prop({ required: true, unique: true })
  ticketHash!: string;

  @Prop({ type: Types.ObjectId, required: true, ref: "User" })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const GoogleLoginTicketSchema = SchemaFactory.createForClass(GoogleLoginTicket);
GoogleLoginTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
