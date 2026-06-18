import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Auth pages — logged-in users get bounced back to the homepage.
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const role = user?.role;

  // Always allow NextAuth internal endpoints and static assets.
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/logos") ||
    pathname.startsWith("/avatars") ||
    /\.(png|jpg|jpeg|svg|ico|webp|gif|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Auth pages — redirect logged-in users away.
  if (AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    if (user) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  // Public landing page — accessible without login (both anonymous and signed-in).
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Everything else requires auth — redirect to login, preserving the target.
  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  // /admin routes: require admin or it role.
  if (pathname.startsWith("/admin") && role !== "admin" && role !== "it") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
