import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { createTransactionSchema, type CreateTransactionDto } from "@lifeos/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types";
import { ZodBody } from "../common/zod-validation.pipe";
import { TransactionsService } from "./transactions.service";

@Controller("transactions")
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { transactions: await this.transactions.list(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodBody(createTransactionSchema)) input: CreateTransactionDto) {
    return { transaction: await this.transactions.create(user.id, input) };
  }
}
