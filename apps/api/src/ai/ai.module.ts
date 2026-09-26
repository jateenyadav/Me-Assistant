import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersModule } from "../users/users.module";
import { McpModule } from "../mcp/mcp.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AiController } from "./ai.controller";
import { AiKey, AiKeySchema } from "./ai-key.schema";
import { AiKeyService } from "./ai-key.service";
import { AiService } from "./ai.service";

@Module({
  imports: [UsersModule, McpModule, JwtModule.register({}), MongooseModule.forFeature([{ name: AiKey.name, schema: AiKeySchema }])],
  controllers: [AiController],
  providers: [AiKeyService, AiService, JwtAuthGuard],
})
export class AiModule {}
