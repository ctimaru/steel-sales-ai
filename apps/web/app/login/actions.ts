"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  PENDING_SIGNUP_EMAIL_COOKIE,
  pendingSignupEmailCookieOptions,
} from "@/lib/auth-email-verification";
import { isRegistrationNext, safeInternalNext } from "@/lib/auth-next";
import { siteUrl } from "@/lib/site";
import { trackServerProductEvent } from "@/lib/product-analytics-events.server";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/user-facing-error";

function ensureSupabaseConfigured() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/login?error=Supabase%20non%20%C3%A8%20ancora%20configurato");
  }
}

async function appOrigin() {
  if (process.env.VERCEL_ENV === "production") return siteUrl;

  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const proto = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function signupErrorMessage(error: { code?: string; message: string; status?: number }) {
  const code = error.code ?? "";

  if (code === "user_already_exists" || code === "user_repeated_signup") {
    return "Esiste già un account con questa email. Accedi oppure recupera la password.";
  }

  if (code === "weak_password") {
    return "La password non rispetta i requisiti di sicurezza. Usa una password più lunga e difficile da indovinare.";
  }

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    error.status === 429
  ) {
    return "Hai effettuato troppi tentativi. Attendi qualche minuto e riprova.";
  }

  return safeErrorMessage(
    error,
    "Non è stato possibile creare l’account. Controlla i dati e riprova.",
  );
}

function appendQuery(path: string, key: string, value: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

async function routeAfterAuthentication(nextPath?: string) {
  const supabase = await createClient();

  const { data: lifecycleData } = await supabase.rpc("lr5_account_lifecycle_state");
  const lifecycle = (lifecycleData ?? {}) as { access_suspended?: boolean };
  if (lifecycle.access_suspended === true) {
    await supabase.auth.signOut({ scope: "global" });
    redirect("/account-closure?requested=1");
  }

  await Promise.all([
    supabase.rpc("claim_pending_organization_invitations"),
    supabase.rpc("sa2_claim_platform_staff_invitation"),
  ]);

  const { data: platformContext } = await supabase.rpc("platform_access_context");
  const authority = (platformContext ?? {}) as {
    is_platform_staff?: boolean;
    staff_status?: string | null;
    permissions?: string[];
  };
  if (authority.is_platform_staff) {
    if (
      authority.staff_status === "active" &&
      authority.permissions?.includes("platform.console.access")
    ) {
      redirect("/platform");
    }
    redirect("/staff/access");
  }

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) {
    if (nextPath && isRegistrationNext(nextPath)) {
      redirect(nextPath);
    }

    const { data: application } = await supabase
      .from("company_registration_applications")
      .select("id,application_status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    redirect(application ? "/registration/status" : "/register");
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("guided_setup_completed_at")
    .eq("id", membership.organization_id)
    .maybeSingle();

  const destination =
    nextPath && !isRegistrationNext(nextPath)
      ? nextPath
      : organization?.guided_setup_completed_at
        ? "/dashboard"
        : "/onboarding";

  const { data: legalData } = await supabase.rpc("lr5_current_legal_acceptance_state");
  const legal = (legalData ?? {}) as { accepted?: boolean };
  if (legal.accepted !== true) {
    redirect("/legal/accept?next=" + encodeURIComponent(destination));
  }

  redirect(destination);
}

export async function login(formData: FormData) {
  ensureSupabaseConfigured();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext = String(formData.get("next") ?? "").trim();
  const nextPath = requestedNext
    ? safeInternalNext(requestedNext, "/dashboard")
    : undefined;
  const nextSuffix = nextPath
    ? "&next=" + encodeURIComponent(nextPath)
    : "";

  if (!email || !password) {
    redirect("/login?error=Inserisci%20email%20e%20password" + nextSuffix);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      const cookieStore = await cookies();
      cookieStore.set(
        PENDING_SIGNUP_EMAIL_COOKIE,
        email,
        pendingSignupEmailCookieOptions,
      );
      redirect(
        "/verify-email?source=login" +
          (nextPath ? "&next=" + encodeURIComponent(nextPath) : ""),
      );
    }

    redirect(
      "/login?error=Credenziali%20non%20valide" + nextSuffix,
    );
  }

  const cookieStore = await cookies();
  cookieStore.delete(PENDING_SIGNUP_EMAIL_COOKIE);

  await routeAfterAuthentication(nextPath);
}

export async function signup(formData: FormData) {
  ensureSupabaseConfigured();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext = safeInternalNext(formData.get("next"), "/register");
  const nextPath = requestedNext.startsWith("/register")
    ? requestedNext
    : "/register";

  if (!email || password.length < 8) {
    redirect(
      appendQuery(
        nextPath,
        "error",
        "Usa una password di almeno 8 caratteri",
      ),
    );
  }

  const supabase = await createClient();
  const origin = await appOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        `${origin}/auth/finish?signup=1&next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    if (error.code === "email_address_not_authorized") {
      redirect(
        appendQuery(
          nextPath,
          "error",
          "Il servizio email di verifica non è ancora configurato per questo indirizzo. Riprova più tardi.",
        ),
      );
    }

    redirect(appendQuery(nextPath, "error", signupErrorMessage(error)));
  }

  await trackServerProductEvent("registration_account_created", {
    source: nextPath.includes("claim_ref=") ? "claim" : "direct",
  });

  const cookieStore = await cookies();
  cookieStore.set(
    PENDING_SIGNUP_EMAIL_COOKIE,
    email,
    pendingSignupEmailCookieOptions,
  );

  if (data.session) {
    await supabase.auth.signOut();
    redirect(
      "/verify-email?error=" +
        encodeURIComponent(
          "La verifica email non è stata applicata correttamente. L’accesso è stato bloccato per sicurezza.",
        ) +
        "&next=" +
        encodeURIComponent(nextPath),
    );
  }

  redirect("/verify-email?sent=1&next=" + encodeURIComponent(nextPath));
}

export async function requestPasswordReset(formData: FormData) {
  ensureSupabaseConfigured();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=Inserisci%20il%20tuo%20indirizzo%20email");
  }

  const supabase = await createClient();
  const origin = await appOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/finish?recovery=1`,
  });

  if (error) {
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent(
          safeErrorMessage(
            error,
            "Non è stato possibile inviare il link di recupero. Riprova tra poco.",
          ),
        ),
    );
  }

  redirect("/forgot-password?message=Se%20l%27account%20esiste%2C%20riceverai%20un%20link%20per%20reimpostare%20la%20password");
}
