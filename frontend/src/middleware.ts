/**
 * Central Next.js authentication, RBAC, and profile lock routing middleware.
 *
 * RULE-AUTH02: Authentication and RBAC centrally enforced in Middleware.
 * RULE-AUTH03: Redirect to login if no cookie present.
 * RULE-AUTH06: Redirect to setup if profile is incomplete.
 * RULE-AUTH07: Non-admins blocked from /admin routes.
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
  const isChangePasswordRoute = pathname === "/auth/change-password";
  const isAuthRoute = pathname.startsWith("/auth");
  const isProfileSetupRoute = pathname === "/profile/setup";
  const isAdminRoute = pathname.startsWith("/admin");
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

  const userRole = payload.role;
  const isAdmin = payload.is_admin === true || userRole === "admin";
  const isProfileComplete = payload.is_profile_complete === true;
  const mustChangePassword = payload.must_change_password === true;

  // 3. Mandatory password change lock (first-time login for admin or provisioned faculty)
  if (mustChangePassword) {
    if (!isChangePasswordRoute) {
      return NextResponse.redirect(new URL("/auth/change-password", request.url));
    }
    return NextResponse.next();
  }

  // If password change is complete, prevent revisiting /auth/change-password
  if (!mustChangePassword && isChangePasswordRoute) {
    return NextResponse.redirect(
      new URL(userRole === "admin" ? "/admin" : "/dashboard", request.url)
    );
  }

  // 4. Strict Admin RBAC route protection (RULE-AUTH07: Allows admins and dual faculty-admins)
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 5. Admin user navigation redirection (Dedicated admin automatically forwarded to /admin)
  if (userRole === "admin") {
    if (pathname === "/" || pathname === "/dashboard" || isAuthRoute) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }


  // 6. Regular student and teacher workflows
  if (pathname === "/" || isAuthRoute) {
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
