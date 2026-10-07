import { createClient } from "@/lib/supabase/server";

export type InvestorOutreachStage =
  | "target"
  | "contacted"
  | "replied"
  | "meeting"
  | "diligence"
  | "term_sheet"
  | "committed"
  | "passed";

export type InvestorOutreachPriority = "high" | "medium" | "low";
export type InvestorType =
  | "vc"
  | "corporate_vc"
  | "family_office"
  | "angel"
  | "strategic"
  | "other";

export type InvestorOutreachEvent = {
  id: string;
  event_type: string;
  summary: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
};

export type InvestorLinkedInvite = {
  id: string;
  share_token: string;
  label: string;
  investor_email: string | null;
  scopes: string[];
  status: "active" | "expired" | "revoked";
  expires_at: string;
  last_accessed_at: string | null;
  access_count: number;
};

export type InvestorOutreachTarget = {
  id: string;
  investor_name: string;
  firm_name: string | null;
  investor_email: string | null;
  investor_type: InvestorType;
  geography: string | null;
  thesis_fit: string | null;
  source: string | null;
  stage: InvestorOutreachStage;
  priority: InvestorOutreachPriority;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  invite: InvestorLinkedInvite | null;
  events: InvestorOutreachEvent[];
};

export type InvestorOutreachBoard = {
  allowed: boolean;
  summary: {
    total: number;
    active: number;
    due_follow_up: number;
    diligence_or_later: number;
  };
  targets: InvestorOutreachTarget[];
};

export async function getInvestorOutreachBoard(): Promise<InvestorOutreachBoard> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mkt8_investor_outreach_list");

  if (error) throw new Error(error.message);

  const payload = (data ?? {}) as Partial<InvestorOutreachBoard>;
  return {
    allowed: payload.allowed === true,
    summary: payload.summary ?? {
      total: 0,
      active: 0,
      due_follow_up: 0,
      diligence_or_later: 0,
    },
    targets: payload.targets ?? [],
  };
}
