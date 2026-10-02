import { createClient } from "@/lib/supabase/server";

export const INVESTOR_BUSINESS_PLAN_COOKIE = "sss_investor_business_plan";

export type InvestorBusinessPlanInvite = {
  id: string;
  share_token: string;
  label: string;
  investor_email: string | null;
  status: "active" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  failed_attempts: number;
  locked_until: string | null;
  last_accessed_at: string | null;
  access_count: number;
};

type InviteListPayload = {
  allowed: boolean;
  invites: InvestorBusinessPlanInvite[];
};

export async function getInvestorBusinessPlanInvites() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "l272a_investor_business_plan_invite_list",
  );

  if (error) throw new Error(error.message);

  const payload = (data ?? { allowed: false, invites: [] }) as InviteListPayload;
  return payload.invites ?? [];
}

export function parseInvestorBusinessPlanCookie(
  cookieValue: string | undefined,
) {
  if (!cookieValue) return null;
  const separator = cookieValue.indexOf(".");
  if (separator <= 0) return null;

  const shareToken = cookieValue.slice(0, separator);
  const sessionToken = cookieValue.slice(separator + 1);
  if (!shareToken || !sessionToken) return null;

  return { shareToken, sessionToken };
}

export async function validateInvestorBusinessPlanSession(
  shareToken: string,
  sessionToken: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "l272a_investor_business_plan_validate",
    {
      p_share_token: shareToken,
      p_session_token: sessionToken,
    },
  );

  if (error) return { ok: false as const };

  const payload = (data ?? {}) as {
    ok?: boolean;
    label?: string;
    session_expires_at?: string;
  };

  if (!payload.ok) return { ok: false as const };

  return {
    ok: true as const,
    label: payload.label ?? "Investor",
    sessionExpiresAt: payload.session_expires_at ?? null,
  };
}
