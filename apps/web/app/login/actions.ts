"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

async function routeAfterAuthentication() {
  const supabase = await createClient();
  await supabase.rpc("claim_pending_organization_invitations");

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) {
    redirect("/onboarding");
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
    redirect("/login?error=Credenziali%20non%20valide");
  }

  await routeAfterAuthentication();
}

export async function signup(formData: FormData) {
  ensureSupabaseConfigured();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) {
    redirect("/login?error=Per%20creare%20un%20account%20usa%20una%20password%20di%20almeno%208%20caratteri");
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
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    await routeAfterAuthentication();
  }

  redirect("/login?message=Controlla%20la%20tua%20email%20per%20confermare%20l%27account");
}
