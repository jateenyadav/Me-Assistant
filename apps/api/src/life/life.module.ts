import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersModule } from "../users/users.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { LifeController } from "./life.controller";
import { LifeRecord, LifeRecordSchema } from "./life.schema";
import { LifeService } from "./life.service";
import { Transaction, TransactionSchema } from "../transactions/schemas/transaction.schema";

@Module({
  imports: [UsersModule, JwtModule.register({}), MongooseModule.forFeature([
    { name: LifeRecord.name, schema: LifeRecordSchema },
    { name: Transaction.name, schema: TransactionSchema },
  ])],
  controllers: [LifeController],
  providers: [LifeService, JwtAuthGuard],
  exports: [LifeService],
})
export class LifeModule {}
