/**
 * Central Next.js authentication and profile lock routing middleware.
 *
 * RULE-AUTH02: Authentication centrally checked in Middleware.
 * RULE-AUTH03: Redirect to login if no cookie present.
 * RULE-AUTH06: Redirect to setup if profile is incomplete.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Helper to decode JWT payload without external libraries on the Edge runtime
function parseJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(base64, "base64");
    const jsonPayload = buffer.toString("utf-8");
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Path classifications
  const isAuthRoute = pathname.startsWith("/auth");
  const isProfileSetupRoute = pathname === "/profile/setup";
  const isStaticRoute =
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico";

  // Skip static files assets
  if (isStaticRoute) {
    return NextResponse.next();
  }

  // Check access_token cookie
  const token = request.cookies.get("access_token")?.value;

  // 1. Unauthenticated workflow
  if (!token) {
    if (!isAuthRoute) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return NextResponse.next();
  }

  // 2. Authenticated workflow
  const payload = parseJwt(token);

  // If token is malformed or expired, clear cookie at root path and redirect to login
  if (!payload || (payload.exp && Date.now() >= payload.exp * 1000)) {
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    response.cookies.set("access_token", "", { maxAge: 0, path: "/" });
    return response;
  }

  const isProfileComplete = payload.is_profile_complete === true;

  // Redirect root `/` to dashboard or setup when authenticated
  if (pathname === "/") {
    if (isProfileComplete) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/profile/setup", request.url));
    }
  }

  // If user tries to visit auth pages when already logged in
  if (isAuthRoute) {
    if (isProfileComplete) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/profile/setup", request.url));
    }
  }

  // Profile setup lock verification (RULE-AUTH06)
  if (!isProfileComplete && !isProfileSetupRoute) {
    return NextResponse.redirect(new URL("/profile/setup", request.url));
  }

  // If profile is already complete, prevent visiting setup page again
  if (isProfileComplete && isProfileSetupRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Match all application routes except static files
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
