import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { PublicUser, UserProfile, UserRole } from "@lifeos/shared";

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class Profile implements UserProfile {
  @Prop() heightCm?: number;
  @Prop() weightKg?: number;
  @Prop() goal?: string;
}
const ProfileSchema = SchemaFactory.createForClass(Profile);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop()
  passwordHash?: string;

  @Prop({ unique: true, sparse: true })
  googleSub?: string;

  // RBAC designed in from day one, even with one real user (Section 8).
  @Prop({ required: true, default: "user", enum: ["user", "admin"] })
  role!: UserRole;

  @Prop({ type: ProfileSchema, default: {} })
  profile!: Profile;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

/** Map a Mongoose doc to the safe shape sent to clients — never leaks passwordHash. */
export function toPublicUser(doc: UserDocument): PublicUser {
  return {
    id: doc._id.toString(),
    email: doc.email,
    role: doc.role,
    profile: {
      heightCm: doc.profile?.heightCm,
      weightKg: doc.profile?.weightKg,
      goal: doc.profile?.goal,
    },
    createdAt: doc.createdAt.toISOString(),
  };
}
