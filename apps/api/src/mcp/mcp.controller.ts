import { All, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { z } from "zod";
import { workoutLogSchema } from "@lifeos/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthUser } from "../auth/types";
import { ZodBody } from "../common/zod-validation.pipe";
import { McpService } from "./mcp.service";
import { ToolExecutionService } from "./tool-execution.service";

const tokenSchema = z.strictObject({
  label: z.string().trim().min(2).max(60),
  scopes: z.array(z.enum(["read", "write"])).min(1).max(2).refine((items) => new Set(items).size === items.length),
});
const settingSchema = z.strictObject({ enabled: z.boolean() });

@Controller("mcp")
export class McpController {
  constructor(private readonly mcp: McpService, private readonly tools: ToolExecutionService, private readonly config: ConfigService) {}

  @Get("settings")
  @UseGuards(JwtAuthGuard)
  async settings(@CurrentUser() user: AuthUser) { return this.mcp.settings(user.id); }

  @Patch("settings")
  @UseGuards(JwtAuthGuard)
  async updateSettings(@CurrentUser() user: AuthUser, @Body(new ZodBody(settingSchema)) input: z.infer<typeof settingSchema>) {
    return this.mcp.setEnabled(user.id, input.enabled);
  }

  @Post("tokens")
  @UseGuards(JwtAuthGuard)
  async createToken(@CurrentUser() user: AuthUser, @Body(new ZodBody(tokenSchema)) input: z.infer<typeof tokenSchema>) {
    return { token: await this.mcp.createToken(user.id, input.label, input.scopes) };
  }

  @Get("tokens")
  @UseGuards(JwtAuthGuard)
  async tokens(@CurrentUser() user: AuthUser) { return { tokens: await this.mcp.listTokens(user.id) }; }

  @Delete("tokens/:id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async revoke(@CurrentUser() user: AuthUser, @Param("id") id: string) { await this.mcp.revoke(user.id, id); }

  @All()
  async handle(@Req() req: Request, @Res() res: Response) {
    const allowed = ["localhost", "127.0.0.1", "[::1]", this.config.get<string>("API_PUBLIC_HOST")].filter(Boolean);
    const hostname = req.headers.host?.startsWith("[") ? req.headers.host.split("]")[0] + "]" : req.headers.host?.split(":")[0];
    if (!hostname || !allowed.includes(hostname)) throw new ForbiddenException("Unrecognized MCP host");
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).origin !== new URL(this.config.get<string>("WEB_ORIGIN", "http://localhost:3000")).origin) {
          throw new ForbiddenException("Unrecognized MCP origin");
        }
      } catch { throw new ForbiddenException("Unrecognized MCP origin"); }
    }
    const { userId, scopes } = await this.mcp.authenticate(req.headers.authorization);
    const server = new McpServer({ name: "lifeos", version: "0.1.0" });
    const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
    if (scopes.includes("read")) {
      server.registerTool("get_transactions", { description: "Recent categorized payments and a 30-day summary", inputSchema: z.object({}) },
        async () => result(await this.tools.getTransactions(userId)));
      server.registerTool("get_food_log", { description: "Recent logged foods", inputSchema: z.object({}) },
        async () => result(await this.tools.getEntries(userId, "food")));
      server.registerTool("get_notes", { description: "Recent private notes", inputSchema: z.object({}) },
        async () => result(await this.tools.getEntries(userId, "note")));
      server.registerTool("get_goal_progress", { description: "Measured goal progress from real activity", inputSchema: z.object({}) },
        async () => result(await this.tools.getGoalProgress(userId)));
    }
    if (scopes.includes("write")) {
      server.registerTool("add_note", { description: "Create a note", inputSchema: z.object({ title: z.string().min(1).max(200), body: z.string().min(1).max(20_000) }) },
        async ({ title, body }) => result(await this.tools.addNote(userId, title, body)));
      server.registerTool("log_workout", { description: "Log a user-supplied workout", inputSchema: workoutLogSchema },
        async (input) => result(await this.tools.logWorkout(userId, input)));
    }
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } finally {
      await server.close();
    }
  }
}
