import { Injectable } from "@nestjs/common";
import { type LifeKind } from "@lifeos/shared";
import { TransactionsService } from "../transactions/transactions.service";
import { LifeService } from "../life/life.service";

@Injectable()
export class ToolExecutionService {
  constructor(private readonly transactions: TransactionsService, private readonly life: LifeService) {}

  async getTransactions(userId: string) {
    const [page, summary] = await Promise.all([this.transactions.list(userId), this.transactions.summary(userId)]);
    return { transactions: page.transactions, summary };
  }

  getEntries(userId: string, kind: LifeKind) {
    return this.life.list(userId, kind);
  }

  getGoalProgress(userId: string) {
    return this.life.goalProgress(userId);
  }

  addNote(userId: string, title: string, body: string) {
    return this.life.create(userId, "note", { title, body, tags: [] });
  }

  logWorkout(userId: string, input: unknown) {
    return this.life.create(userId, "workout", input);
  }
}
