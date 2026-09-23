import { BadRequestException, Body, ConflictException, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import type { Request, Response } from "express";
import { ZodBody } from "../common/zod-validation.pipe";
import { GoogleAuthService } from "./google-auth.service";

const exchangeSchema = z.object({ ticket: z.string().regex(/^[a-f0-9]{64}$/) });
const clientStateSchema = z.string().regex(/^[a-f0-9]{64}$/);
const STATE_COOKIE = "lifeos_google_state";

@Controller("auth/google")
export class GoogleAuthController {
  constructor(private readonly google: GoogleAuthService, private readonly config: ConfigService) {}

  @Get()
  async begin(@Query("state") clientState: string, @Res() response: Response) {
    if (!clientStateSchema.safeParse(clientState).success) throw new BadRequestException("Invalid sign-in state");
    const { url, state } = await this.google.begin(clientState);
    response.setHeader("Cache-Control", "no-store");
    response.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.getOrThrow<string>("GOOGLE_REDIRECT_URI").startsWith("https:"),
      maxAge: 5 * 60 * 1000,
      path: "/auth/google",
    });
    response.redirect(302, url);
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    const cookieState = request.headers.cookie?.split(";").map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1) ?? "";
    response.clearCookie(STATE_COOKIE, { path: "/auth/google" });
    try {
      const destination = await this.google.complete(code, state, cookieState);
      response.redirect(303, destination);
    } catch (error) {
      const destination = new URL("/login", this.config.getOrThrow<string>("WEB_ORIGIN"));
      destination.searchParams.set("google", error instanceof ConflictException ? "existing" : "failed");
      response.redirect(303, destination.toString());
    }
  }

  @Post("exchange")
  exchange(@Body(new ZodBody(exchangeSchema)) body: z.infer<typeof exchangeSchema>) {
    return this.google.exchange(body.ticket);
  }
}
