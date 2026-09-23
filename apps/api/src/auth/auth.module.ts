import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RefreshToken, RefreshTokenSchema } from "./schemas/refresh-token.schema";
import { GoogleAuthAttempt, GoogleAuthAttemptSchema, GoogleLoginTicket, GoogleLoginTicketSchema } from "./schemas/google-auth-attempt.schema";
import { GoogleAuthService } from "./google-auth.service";
import { GoogleAuthController } from "./google-auth.controller";

@Module({
  imports: [
    UsersModule,
    JwtModule.register({}), // secret passed per-call at sign/verify time
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: GoogleAuthAttempt.name, schema: GoogleAuthAttemptSchema },
      { name: GoogleLoginTicket.name, schema: GoogleLoginTicketSchema },
    ]),
  ],
  controllers: [AuthController, GoogleAuthController],
  providers: [AuthService, GoogleAuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
