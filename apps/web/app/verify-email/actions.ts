"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  PENDING_SIGNUP_EMAIL_COOKIE,
  pendingSignupEmailCookieOptions,
} from "@/lib/auth-email-verification";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/user-facing-error";

async function appOrigin() {
  if (process.env.VERCEL_ENV === "production") return siteUrl;

  const incoming = await headers();
  const host =
    incoming.get("x-forwarded-host") ??
    incoming.get("host") ??
    "localhost:3000";
  const proto =
    incoming.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

function resendErrorMessage(error: {
  code?: string;
  message: string;
  status?: number;
}) {
  if (error.code === "email_address_not_authorized") {
    return "Il servizio email di verifica non è ancora configurato per questo indirizzo.";
  }

  if (
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit" ||
    error.status === 429
  ) {
    return "Hai richiesto un nuovo link troppo presto. Attendi qualche minuto e riprova.";
  }

  return safeErrorMessage(
    error,
    "Non è stato possibile reinviare il link di verifica. Riprova tra poco.",
  );
}

export async function resendSignupConfirmation() {
  const cookieStore = await cookies();
  const email = cookieStore.get(PENDING_SIGNUP_EMAIL_COOKIE)?.value
    ?.trim()
    .toLowerCase();

  if (!email) {
    redirect(
      "/verify-email?error=" +
        encodeURIComponent(
          "Inserisci nuovamente il tuo indirizzo dalla pagina di registrazione.",
        ),
    );
  }

  const supabase = await createClient();
  const origin = await appOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${origin}/auth/finish?signup=1`,
    },
  });

  if (error) {
    redirect(
      `/verify-email?error=${encodeURIComponent(resendErrorMessage(error))}`,
    );
  }

  cookieStore.set(
    PENDING_SIGNUP_EMAIL_COOKIE,
    email,
    pendingSignupEmailCookieOptions,
  );

  redirect("/verify-email?resent=1");
}
