import {
  createAuthorizationRequest,
  OIDC_FLOW_COOKIE
} from "../../../lib/auth.ts";
import { NextResponse } from "next/server.js";

export async function GET() {
  const { url, flowToken } = await createAuthorizationRequest();
  const response = NextResponse.redirect(url);

  response.cookies.set(OIDC_FLOW_COOKIE, flowToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/telegram/callback",
    maxAge: 600
  });
  return response;
}
