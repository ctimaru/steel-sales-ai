"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  PENDING_SIGNUP_EMAIL_COOKIE,
  pendingSignupEmailCookieOptions,
} from "@/lib/auth-email-verification";
import { createClient } from "@/lib/supabase/server";

function ensureSupabaseConfigured() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    redirect("/login?error=Supabase%20non%20%C3%A8%20ancora%20configurato");
  }
}

async function appOrigin() {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const proto = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function signupErrorMessage(error: { code?: string; message: string }) {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  if (
    code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already exists")
  ) {
    return "Esiste già un account con questa email. Accedi oppure recupera la password.";
  }

  if (code === "weak_password" || message.includes("password")) {
    return "La password non rispetta i requisiti di sicurezza. Prova con una password più lunga e difficile da indovinare.";
  }

  if (message.includes("rate") || message.includes("too many")) {
    return "Hai effettuato troppi tentativi. Riprova tra qualche minuto.";
  }

  return "Non è stato possibile creare l’account. Controlla i dati e riprova.";
}

async function routeAfterAuthentication() {
  const supabase = await createClient();
  await supabase.rpc("claim_pending_organization_invitations");
  await supabase.rpc("sa2_claim_platform_staff_invitation");

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
    .select("onboarding_status")
    .eq("id", membership.organization_id)
    .maybeSingle();

  redirect(organization?.onboarding_status === "completed" ? "/dashboard" : "/onboarding");
}

export async function login(formData: FormData) {
  ensureSupabaseConfigured();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Inserisci%20email%20e%20password");
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
      redirect("/verify-email?source=login");
    }

    redirect("/login?error=Credenziali%20non%20valide");
  }

  const cookieStore = await cookies();
  cookieStore.delete(PENDING_SIGNUP_EMAIL_COOKIE);

  await routeAfterAuthentication();
}

export async function signup(formData: FormData) {
  ensureSupabaseConfigured();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) {
    redirect("/register?error=Usa%20una%20password%20di%20almeno%208%20caratteri");
  }

  const supabase = await createClient();
  const origin = await appOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/finish?signup=1`,
    },
  });

  if (error) {
    if (error.code === "email_address_not_authorized") {
      redirect(
        "/register?error=" +
          encodeURIComponent(
            "Il servizio email di verifica non è ancora configurato per questo indirizzo. Riprova più tardi.",
          ),
      );
    }

    redirect(`/register?error=${encodeURIComponent(signupErrorMessage(error))}`);
  }

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
        ),
    );
  }

  redirect("/verify-email?sent=1");
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
    redirect("/forgot-password?error=Non%20%C3%A8%20stato%20possibile%20inviare%20il%20link%20di%20recupero");
  }

  redirect("/forgot-password?message=Se%20l%27account%20esiste%2C%20riceverai%20un%20link%20per%20reimpostare%20la%20password");
}
