import { createClient } from "@/lib/supabase/server";

export const INVESTOR_BUSINESS_PLAN_COOKIE = "sss_investor_business_plan";

export type InvestorScope = "business_plan" | "marketing" | "kpi";

export type InvestorBusinessPlanInvite = {
  id: string;
  share_token: string;
  label: string;
  investor_email: string | null;
  scopes: InvestorScope[];
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

export async function getInvestorAccessInvites() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("l272d2_investor_access_list");

  if (error) throw new Error(error.message);

  const payload = (data ?? { allowed: false, invites: [] }) as InviteListPayload;
  return payload.invites ?? [];
}

export async function getInvestorBusinessPlanInvites() {
  return getInvestorAccessInvites();
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

export async function validateInvestorAccessSession(
  shareToken: string,
  sessionToken: string,
  requiredScope?: InvestorScope,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "l272d2_investor_access_validate",
    {
      p_share_token: shareToken,
      p_session_token: sessionToken,
      p_required_scope: requiredScope ?? null,
    },
  );

  if (error) return { ok: false as const };

  const payload = (data ?? {}) as {
    ok?: boolean;
    code?: string;
    label?: string;
    scopes?: InvestorScope[];
    session_expires_at?: string;
  };

  if (!payload.ok) {
    return {
      ok: false as const,
      code: payload.code ?? "access_denied",
      scopes: payload.scopes ?? [],
    };
  }

  return {
    ok: true as const,
    label: payload.label ?? "Investor",
    scopes: payload.scopes ?? [],
    sessionExpiresAt: payload.session_expires_at ?? null,
  };
}

export async function validateInvestorBusinessPlanSession(
  shareToken: string,
  sessionToken: string,
) {
  return validateInvestorAccessSession(
    shareToken,
    sessionToken,
    "business_plan",
  );
}

export type InvestorKpiMetric = {
  key: string;
  label: string;
  value: string | number;
  status: "measured_prelaunch" | "target" | "hypothesis";
  note: string;
};

export type InvestorKpiSnapshot = {
  as_of: string;
  stage: "pre_launch";
  measured: InvestorKpiMetric[];
  targets: InvestorKpiMetric[];
};

export async function getOwnerInvestorKpiSnapshot() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("l272d2_owner_kpi_snapshot");
  if (error) throw new Error(error.message);
  return data as InvestorKpiSnapshot;
}

export async function getInvestorKpiSnapshot(
  shareToken: string,
  sessionToken: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("l272d2_investor_kpi_snapshot", {
    p_share_token: shareToken,
    p_session_token: sessionToken,
  });

  if (error) return { ok: false as const };

  const payload = (data ?? {}) as {
    ok?: boolean;
    label?: string;
    scopes?: InvestorScope[];
    snapshot?: InvestorKpiSnapshot;
  };

  if (!payload.ok || !payload.snapshot) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    label: payload.label ?? "Investor",
    scopes: payload.scopes ?? [],
    snapshot: payload.snapshot,
  };
}
