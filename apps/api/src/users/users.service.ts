import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import type { UpdateProfileDto } from "@lifeos/shared";

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  updateProfile(id: string, input: UpdateProfileDto): Promise<UserDocument | null> {
    const fields = Object.fromEntries(Object.entries(input).map(([key, value]) => [`profile.${key}`, value]));
    return this.userModel.findByIdAndUpdate(id, { $set: fields }, { returnDocument: "after", runValidators: true }).exec();
  }

  updateMcpEnabled(id: string, enabled: boolean): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, { $set: { mcpEnabled: enabled } }, { returnDocument: "after" }).exec();
  }

  create(email: string, passwordHash: string): Promise<UserDocument> {
    return this.userModel.create({ email: email.toLowerCase(), passwordHash });
  }

  async findOrCreateGoogle(googleSub: string, email: string): Promise<UserDocument> {
    const byGoogle = await this.userModel.findOne({ googleSub }).exec();
    if (byGoogle) return byGoogle;

    const normalizedEmail = email.toLowerCase();
    if (await this.findByEmail(normalizedEmail)) {
      throw new ConflictException("An account already uses this email. Sign in with your password.");
    }
    try {
      return await this.userModel.create({ email: normalizedEmail, googleSub });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        const concurrent = await this.userModel.findOne({ googleSub }).exec();
        if (concurrent) return concurrent;
        throw new ConflictException("An account already uses this email. Sign in with your password.");
      }
      throw error;
    }
  }
}
