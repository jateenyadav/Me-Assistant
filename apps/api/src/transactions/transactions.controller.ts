import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { categorizeNotificationSchema, createTransactionSchema, emailTextSchema, importEmailSchema, importNotificationSchema, transactionListQuerySchema, type CategorizeNotificationDto, type CreateTransactionDto, type EmailTextDto, type ImportEmailDto, type ImportNotificationDto, type TransactionListQuery } from "@lifeos/shared";
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
  async list(@CurrentUser() user: AuthUser, @Query(new ZodBody(transactionListQuerySchema)) query: TransactionListQuery) {
    return this.transactions.list(user.id, query.cursor);
  }

  @Get("summary")
  async summary(@CurrentUser() user: AuthUser) {
    return { summary: await this.transactions.summary(user.id) };
  }

  @Get("trend")
  async trend(@CurrentUser() user: AuthUser) {
    return { trend: await this.transactions.trend(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodBody(createTransactionSchema)) input: CreateTransactionDto) {
    return { transaction: await this.transactions.create(user.id, input) };
  }

  @Post("notifications")
  async importNotification(@CurrentUser() user: AuthUser, @Body(new ZodBody(importNotificationSchema)) input: ImportNotificationDto) {
    return this.transactions.importNotification(user.id, input);
  }

  @Post("emails/preview")
  previewEmail(@Body(new ZodBody(emailTextSchema)) input: EmailTextDto) {
    return { payment: this.transactions.previewEmail(input.text) };
  }

  @Post("emails")
  async importEmail(@CurrentUser() user: AuthUser, @Body(new ZodBody(importEmailSchema)) input: ImportEmailDto) {
    return { transaction: await this.transactions.importEmail(user.id, input) };
  }

  @Get("notifications/pending")
  async pending(@CurrentUser() user: AuthUser) {
    return { notifications: await this.transactions.pending(user.id) };
  }

  @Patch("notifications/:id/category")
  async categorize(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body(new ZodBody(categorizeNotificationSchema)) input: CategorizeNotificationDto) {
    return { transaction: await this.transactions.categorize(user.id, id, input.category) };
  }
}
