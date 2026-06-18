import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

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

  // Allow public pages (login, register, …).
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // If already logged in, bounce away from login/register to home.
    if (req.auth) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Everything else requires authentication.
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Match all paths except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
