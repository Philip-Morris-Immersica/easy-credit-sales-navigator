import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

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

  // Public pages — redirect logged-in users away.
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (user) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  // Unauthenticated users: redirect to login.
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
