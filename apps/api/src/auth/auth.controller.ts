import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  logoutSchema,
  type LoginDto,
  type RegisterDto,
  type RefreshDto,
  type LogoutDto,
} from "@lifeos/shared";
import { ZodBody } from "../common/zod-validation.pipe";
import { UsersService } from "../users/users.service";
import { toPublicUser } from "../users/schemas/user.schema";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import type { AuthUser } from "./types";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post("register")
  register(@Body(new ZodBody(registerSchema)) dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodBody(loginSchema)) dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodBody(refreshSchema)) dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body(new ZodBody(logoutSchema)) dto: LogoutDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() principal: AuthUser) {
    const user = await this.users.findById(principal.id);
    return { user: user ? toPublicUser(user) : null };
  }
}
