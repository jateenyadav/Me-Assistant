import { Controller, Get } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  async check() {
    // readyState 1 = connected. Ping to confirm the DB actually answers.
    let db: "up" | "down" = "down";
    try {
      if (this.connection.readyState === 1 && this.connection.db) {
        await this.connection.db.admin().ping();
        db = "up";
      }
    } catch {
      db = "down";
    }
    return { status: db === "up" ? "ok" : "degraded", db, ts: new Date().toISOString() };
  }
}
