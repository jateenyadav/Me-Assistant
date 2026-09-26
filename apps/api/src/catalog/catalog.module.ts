import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { UsersModule } from "../users/users.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

@Module({ imports: [UsersModule, JwtModule.register({})], controllers: [CatalogController], providers: [CatalogService, JwtAuthGuard] })
export class CatalogModule {}
