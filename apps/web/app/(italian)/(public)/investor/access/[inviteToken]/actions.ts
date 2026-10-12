"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  INVESTOR_BUSINESS_PLAN_COOKIE,
  parseInvestorBusinessPlanCookie,
} from "@/lib/investor-business-plan";
import { createClient } from "@/lib/supabase/server";

function portalPath(inviteToken: string, error?: string) {
  const base = `/investor/access/${inviteToken}`;
  if (!error) return base;
  return `${base}?error=${encodeURIComponent(error)}`;
}

export async function loginInvestorAccess(formData: FormData) {
  const inviteToken = String(formData.get("invite_token") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!inviteToken || !password) {
    redirect(portalPath(inviteToken, "Inserisci la password dell'invito."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "l272a_investor_business_plan_login",
    {
      p_share_token: inviteToken,
      p_password: password,
    },
  );

  if (error) {
    redirect(portalPath(inviteToken, "Accesso non disponibile."));
  }

  const payload = (data ?? {}) as {
    ok?: boolean;
    code?: "access_denied" | "locked";
    session_token?: string;
    session_expires_at?: string;
  };

  if (!payload.ok || !payload.session_token || !payload.session_expires_at) {
    redirect(
      portalPath(
        inviteToken,
        payload.code === "locked"
          ? "Accesso temporaneamente bloccato dopo troppi tentativi. Riprova più tardi."
          : "Password o invito non validi.",
      ),
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(
    INVESTOR_BUSINESS_PLAN_COOKIE,
    `${inviteToken}.${payload.session_token}`,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/investor",
      expires: new Date(payload.session_expires_at),
    },
  );

  redirect(portalPath(inviteToken));
}

export async function logoutInvestorAccess(formData: FormData) {
  const inviteToken = String(formData.get("invite_token") ?? "").trim();
  const cookieStore = await cookies();
  const parsed = parseInvestorBusinessPlanCookie(
    cookieStore.get(INVESTOR_BUSINESS_PLAN_COOKIE)?.value,
  );

  if (parsed && parsed.shareToken === inviteToken) {
    const supabase = await createClient();
    await supabase.rpc("l272a_investor_business_plan_logout", {
      p_share_token: parsed.shareToken,
      p_session_token: parsed.sessionToken,
    });
  }

  cookieStore.delete(INVESTOR_BUSINESS_PLAN_COOKIE);
  redirect(portalPath(inviteToken));
}
