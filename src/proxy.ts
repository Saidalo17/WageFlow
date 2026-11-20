import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_PAGES = ["/login", "/register"];

// Guests may only see the sign-in and sign-up pages; signed-in users are kept off them.
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthPage = AUTH_PAGES.includes(pathname);
  const signedIn = !!req.auth;

  if (!signedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (signedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
