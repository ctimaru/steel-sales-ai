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
