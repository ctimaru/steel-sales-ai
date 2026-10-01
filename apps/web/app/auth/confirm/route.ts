import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { PENDING_SIGNUP_EMAIL_COOKIE } from "@/lib/auth-email-verification";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/register";
  return value;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  const successUrl = request.nextUrl.clone();
  successUrl.pathname = next;
  successUrl.search = "";

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/verify-email";
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
  return response;
}
