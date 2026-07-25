import { NextResponse, type NextRequest } from "next/server.js";
import { DEMO_SESSION_COOKIE, hasDemoSession } from "./lib/demo-session.ts";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const signedIn = hasDemoSession(
    request.cookies.get(DEMO_SESSION_COOKIE)?.value
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
