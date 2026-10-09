import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function schoolPathForPublicKnowledge(pathname: string) {
  if (pathname === "/knowledge") return "/school/catalogo";
  if (pathname.startsWith("/knowledge/")) {
    return "/school" + pathname.slice("/knowledge".length);
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.next({ request });
  }

  // PERF1: the public homepage is fully static. Anonymous visits have no
  // Supabase auth cookie, so avoid initializing/authenticating a server client.
  // Chunked SSR auth cookies are named sb-<project>-auth-token.0, .1, etc.
  const isPublicHome = request.nextUrl.pathname === "/";
  const hasAuthCookie = request.cookies.getAll().some(({ name }) =>
    /^sb-[A-Za-z0-9_-]+-auth-token(?:\\.\\d+)?$/.test(name),
  );
  if (isPublicHome && !hasAuthCookie) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Preserve the former homepage behavior: only a verified, live user
  // reaches /dashboard. A cookie alone never grants access or redirects.
  if (isPublicHome) {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      const target = request.nextUrl.clone();
      target.pathname = "/dashboard";
      target.search = "";
      target.hash = "";
      const redirectResponse = NextResponse.redirect(target);
      redirectResponse.headers.set("Cache-Control", "private, no-store");
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
    return response;
  }

  // All other routes keep their current claims-based routing and guards.
  const { data } = await supabase.auth.getClaims();
  const schoolPath =
    data?.claims?.sub && request.nextUrl.searchParams.get("public") !== "1"
      ? schoolPathForPublicKnowledge(request.nextUrl.pathname)
      : null;

  if (schoolPath) {
    const target = request.nextUrl.clone();
    target.pathname = schoolPath;
    const redirectResponse = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}
