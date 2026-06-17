import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;
  const role = user?.role;

  // Unauthenticated users: redirect from protected routes
  if (!user && (pathname.startsWith("/admin") || pathname.startsWith("/me"))) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /admin routes: require admin or it role
  if (pathname.startsWith("/admin") && role !== "admin" && role !== "it") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Redirect already-logged-in users away from auth pages
  if (
    user &&
    (pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password")
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/me/:path*",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
