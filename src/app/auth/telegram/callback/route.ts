import {
  completeTelegramLogin,
  createSessionToken,
  OIDC_FLOW_COOKIE,
  readAuthConfig,
  SESSION_COOKIE
} from "../../../../lib/auth.ts";
import { NextRequest, NextResponse } from "next/server.js";

export async function GET(request: NextRequest) {
  const config = readAuthConfig();
  const result = await completeTelegramLogin({
    code: request.nextUrl.searchParams.get("code"),
    state: request.nextUrl.searchParams.get("state"),
    flowToken: request.cookies.get(OIDC_FLOW_COOKIE)?.value,
    config
  });
  const destination = result.status === "authorized"
    ? "/dashboard"
    : `/?error=${result.status}`;
  const response = NextResponse.redirect(new URL(destination, config.appUrl));

  response.cookies.set(OIDC_FLOW_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/telegram/callback",
    maxAge: 0
  });

  if (result.status === "authorized") {
    response.cookies.set(
      SESSION_COOKIE,
      await createSessionToken(result.identity, config),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      }
    );
  }
  return response;
}
