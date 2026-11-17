// Runs before every /admin request (Next.js 16 calls this file "proxy";
// earlier versions called it "middleware").
//
// It does two things: keeps the Supabase session cookie fresh, and sends
// signed-out visitors to the login page. It is a convenience, not the lock:
// the lock is row level security in the database, which refuses writes from
// anyone who is not in the `admins` table no matter what the browser does.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

const LOGIN_PATH = "/admin/login";

export async function proxy(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const onLoginPage = request.nextUrl.pathname === LOGIN_PATH;
  if (!user && !onLoginPage) return redirectTo(request, LOGIN_PATH, response);
  if (user && onLoginPage) return redirectTo(request, "/admin", response);
  return response;
}

/** Redirects while keeping any refreshed session cookies. */
function redirectTo(request: NextRequest, pathname: string, from: NextResponse) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/admin/:path*"],
};
