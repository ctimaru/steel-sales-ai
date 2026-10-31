import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { PENDING_SIGNUP_EMAIL_COOKIE, PENDING_SIGNUP_NEXT_COOKIE } from "@/lib/auth-email-verification";
import { safeInternalNext } from "@/lib/auth-next";
import { siteUrl } from "@/lib/site";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/register";
  return safeInternalNext(value, "/register");
}

function nextFromSignupRedirect(value: string | null, origin: string): string | null {
  if (!value) return null;
  try {
    const target = new URL(value);
    // RedirectTo comes from a trusted Supabase redirect allow-list, but verify
    // both origin and exact auth callback path on this server regardless.
    // Next.js may normalize request.nextUrl.origin to an internal host when
    // behind a proxy. The signup callback itself uses the configured public
    // site origin; allow exactly either trusted origin, never arbitrary hosts.
    const canonicalOrigin = new URL(siteUrl).origin;
    if (
      (target.origin !== origin && target.origin !== canonicalOrigin) ||
      target.pathname !== "/auth/finish" ||
      target.searchParams.get("signup") !== "1"
    ) return null;
    const path = safeInternalNext(target.searchParams.get("next"), "/register");
    return path.startsWith("/en/register") || path.startsWith("/register") ? path : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const legacyNext = safeNext(request.nextUrl.searchParams.get("next"));
  const cookieStore = await cookies();
  const pendingNext = safeInternalNext(cookieStore.get(PENDING_SIGNUP_NEXT_COOKIE)?.value, "/register");
  const cookieFallback = legacyNext === "/register" && pendingNext.startsWith("/en/register") ? pendingNext : legacyNext;
  const next = nextFromSignupRedirect(request.nextUrl.searchParams.get("redirect_to"), request.nextUrl.origin) ?? cookieFallback;

  const successUrl = request.nextUrl.clone();
  // A claim reference belongs in the query string, not the URL pathname.
  const destination = new URL(next, request.nextUrl.origin);
  successUrl.pathname = destination.pathname;
  successUrl.search = destination.search;
  successUrl.hash = destination.hash;

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = next.startsWith("/en/register") ? "/en/verify-email" : "/verify-email";
  errorUrl.search = "";
  errorUrl.searchParams.set(
    "error",
    "Il link di verifica non è valido o è scaduto. Richiedi un nuovo link.",
  );

  if (!tokenHash || !type) {
    return NextResponse.redirect(errorUrl);
  }

  // Route handlers must explicitly put GoTrue's new auth cookies on the
  // response returned to the *other* browser. Setting them only on the
  // next/headers cookie store is insufficient for this redirect path.
  const response = NextResponse.redirect(successUrl);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });
  if (error) {
    // No session cookies from a failed verification are returned.
    return NextResponse.redirect(errorUrl);
  }

  response.cookies.delete(PENDING_SIGNUP_EMAIL_COOKIE);
  response.cookies.delete(PENDING_SIGNUP_NEXT_COOKIE);
  return response;
}
