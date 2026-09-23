import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

/**
 * One document per issued refresh token. The token handed to the client is
 * `${jti}.${secret}`; we store only bcrypt(secret), never the secret itself.
 * Rotation revokes the old doc; a revoked jti reappearing = reuse → theft.
 */
@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  jti!: string;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ required: true, default: false })
  revoked!: boolean;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// TTL index: Mongo auto-purges expired tokens so the collection can't grow forever.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
