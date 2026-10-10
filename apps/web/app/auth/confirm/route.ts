import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { PENDING_SIGNUP_EMAIL_COOKIE, PENDING_SIGNUP_NEXT_COOKIE } from "@/lib/auth-email-verification";
import { safeInternalNext } from "@/lib/auth-next";
import { createClient } from "@/lib/supabase/server";

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
    if (target.origin !== origin || target.pathname !== "/auth/finish" || target.searchParams.get("signup") !== "1") return null;
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

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(errorUrl);
  }

  const response = NextResponse.redirect(successUrl);
  response.cookies.delete(PENDING_SIGNUP_EMAIL_COOKIE);
  response.cookies.delete(PENDING_SIGNUP_NEXT_COOKIE);
  return response;
}
