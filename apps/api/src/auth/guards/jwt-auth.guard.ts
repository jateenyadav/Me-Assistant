import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { UsersService } from "../../users/users.service";
import type { AccessTokenPayload, AuthUser } from "../types";

/**
 * Custom JWT guard — verifies the Bearer access token without Passport's DI
 * complexity. Attaches the validated AuthUser to req.user for @CurrentUser().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractBearer(req);
    if (!token) throw new UnauthorizedException("No token provided");

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException("User no longer exists");

    req.user = { id: user._id.toString(), email: user.email, role: user.role };
    return true;
  }

  private extractBearer(req: Request): string | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    return auth.slice(7);
  }
}
