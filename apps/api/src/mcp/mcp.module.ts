import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersModule } from "../users/users.module";
import { LifeModule } from "../life/life.module";
import { TransactionsModule } from "../transactions/transactions.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";
import { McpToken, McpTokenSchema } from "./mcp-token.schema";
import { ToolExecutionService } from "./tool-execution.service";

@Module({
  imports: [UsersModule, LifeModule, TransactionsModule, JwtModule.register({}),
    MongooseModule.forFeature([{ name: McpToken.name, schema: McpTokenSchema }])],
  controllers: [McpController],
  providers: [McpService, ToolExecutionService, JwtAuthGuard],
  exports: [ToolExecutionService],
})
export class McpModule {}
