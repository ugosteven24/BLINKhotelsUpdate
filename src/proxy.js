// Next.js 16: this file replaces middleware.js. Delete src/middleware.js.
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Signed-out users can't see the dashboard.
  if (isDashboard && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Cheap first gate for the admin area (cookie signature only). The real check
  // (session row in MySQL + admin role) runs in the (Admin) layout and in every
  // admin Server Action.
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) {
    if (!session) {
      return NextResponse.redirect(new URL("/Adminlogin", request.url));
    }
  }

  // Pass the path to the root layout (layouts can't read the URL).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

// export const config = {
//   // Run on every page request so the root layout always gets x-pathname.
//   matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
// };

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !req.cookies.get("admin_session")) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}
export const config = { matcher: ["/admin/:path*"] };
