import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthUser } from "../auth/types";
import { LifeService } from "./life.service";

@Controller("life")
@UseGuards(JwtAuthGuard)
export class LifeController {
  constructor(private readonly life: LifeService) {}

  @Get("food/summary")
  async foodSummary(@CurrentUser() user: AuthUser) {
    return { summary: await this.life.foodSummary(user.id) };
  }

  @Get("workout/stats")
  async workoutStats(@CurrentUser() user: AuthUser) {
    return { exercises: await this.life.workoutStats(user.id) };
  }

  @Get("goals/progress")
  async goalProgress(@CurrentUser() user: AuthUser) {
    return { progress: await this.life.goalProgress(user.id) };
  }

  @Get(":kind")
  async list(@CurrentUser() user: AuthUser, @Param("kind") kind: string) {
    return { entries: await this.life.list(user.id, this.life.parseKind(kind)) };
  }

  @Post(":kind")
  async create(@CurrentUser() user: AuthUser, @Param("kind") kind: string, @Body() body: unknown) {
    return { entry: await this.life.create(user.id, this.life.parseKind(kind), body) };
  }

  @Put(":kind/:id")
  async replace(@CurrentUser() user: AuthUser, @Param("kind") kind: string, @Param("id") id: string, @Body() body: unknown) {
    return { entry: await this.life.replace(user.id, this.life.parseKind(kind), id, body) };
  }

  @Delete(":kind/:id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("kind") kind: string, @Param("id") id: string) {
    await this.life.remove(user.id, this.life.parseKind(kind), id);
  }
}
