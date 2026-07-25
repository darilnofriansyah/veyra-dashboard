import { NextResponse, type NextRequest } from "next/server.js";
import { SESSION_COOKIE, verifySessionToken } from "./lib/auth.ts";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const signedIn = Boolean(
    await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  );

  if (path === "/" && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (path === "/dashboard" && !signedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard"]
};
