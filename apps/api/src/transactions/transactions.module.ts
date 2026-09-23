import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersModule } from "../users/users.module";
import { Transaction, TransactionSchema } from "./schemas/transaction.schema";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

@Module({
  imports: [UsersModule, JwtModule.register({}), MongooseModule.forFeature([{ name: Transaction.name, schema: TransactionSchema }])],
  controllers: [TransactionsController],
  providers: [TransactionsService, JwtAuthGuard],
})
export class TransactionsModule {}
