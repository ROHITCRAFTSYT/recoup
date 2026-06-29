import { NextResponse, type NextRequest } from "next/server";
import { isValidToken, SESSION_COOKIE } from "@/lib/auth-edge";

// Guard the app. Unauthenticated users are sent to /login; the login page and
// auth API stay public. Static assets are excluded via the matcher below.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/ingest") || // accounting-system surface
    pathname.startsWith("/api/reply") || // inbound debtor replies
    pathname.startsWith("/api/telegram"); // Telegram webhook

  const valid = await isValidToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (!valid && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (valid && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
