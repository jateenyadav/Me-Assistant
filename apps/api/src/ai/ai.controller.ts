import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards, BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthUser } from "../auth/types";
import { ZodBody } from "../common/zod-validation.pipe";
import { AiKeyService, type ByokProvider } from "./ai-key.service";
import { AiService } from "./ai.service";

const byokProvider = z.enum(["openai", "anthropic", "google"]);
const saveKeySchema = z.strictObject({ provider: byokProvider, key: z.string().trim().min(20).max(2048) });
const chatSchema = z.strictObject({ provider: z.enum(["bedrock", "openai", "anthropic", "google"]),
  question: z.string().trim().min(2).max(2000), consent: z.literal(true) });

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly keys: AiKeyService, private readonly ai: AiService) {}

  @Get("keys")
  async list(@CurrentUser() user: AuthUser) { return { keys: await this.keys.list(user.id) }; }

  @Post("keys")
  async save(@CurrentUser() user: AuthUser, @Body(new ZodBody(saveKeySchema)) input: z.infer<typeof saveKeySchema>) {
    return this.keys.save(user.id, input.provider, input.key);
  }

  @Delete("keys/:provider")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("provider") value: string) {
    const provider = byokProvider.safeParse(value);
    if (!provider.success) throw new BadRequestException("Unknown AI provider");
    await this.keys.remove(user.id, provider.data as ByokProvider);
  }

  @Post("chat")
  async chat(@CurrentUser() user: AuthUser, @Body(new ZodBody(chatSchema)) input: z.infer<typeof chatSchema>) {
    return this.ai.chat(user.id, input.provider, input.question);
  }
}
