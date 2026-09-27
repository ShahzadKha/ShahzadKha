import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";

// Send visitors without a valid session to the login page
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);

  // Public: candidate web form, offer and unsubscribe pages, email tracking, and APIs that check their own key
  if (
    pathname === "/apply" ||
    pathname === "/api/intake" ||
    pathname.startsWith("/offre/") ||
    pathname.startsWith("/desinscription/") ||
    pathname.startsWith("/paiement/") ||
    pathname.startsWith("/avis/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/t/") ||
    pathname.startsWith("/api/cron/")
  ) {
    return NextResponse.next();
  }

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
