import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Structured, level-based logging from day one (observability, Section 8).
    logger: ["error", "warn", "log", "debug"],
  });

  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>("WEB_ORIGIN", "http://localhost:3000"),
    credentials: true,
  });

  // Validation is handled per-route by ZodBody pipes (packages/shared Zod schemas).
  // No global class-validator ValidationPipe needed.

  const port = config.get<number>("PORT", 4000);
  await app.listen(port);
  Logger.log(`LifeOS API listening on http://localhost:${port}`, "Bootstrap");
}

void bootstrap();
