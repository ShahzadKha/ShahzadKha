import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// A session that is still signed but no longer accepted (account deactivated, password changed
// on another device): clear the cookie, otherwise /login would send the visitor back in a loop.
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
