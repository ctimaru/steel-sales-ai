"use server";

import { createClient } from "@/lib/supabase/server";

export type PublicCompanyLookupItem = {
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  vat_hint: string | null;
  claim_state: "claimable" | "claim_in_progress" | "claimed";
  claim_ref: string;
};

export type PublicCompanyLookupState = {
  status: "idle" | "invalid" | "error" | "not_found" | "ok";
  mode: "name" | "vat" | null;
  items: PublicCompanyLookupItem[];
};

export const initialPublicCompanyLookupState: PublicCompanyLookupState = {
  status: "idle",
  mode: null,
  items: [],
};

export async function lookupPublicCompany(
  _previous: PublicCompanyLookupState,
  formData: FormData,
): Promise<PublicCompanyLookupState> {
  const query = String(formData.get("company_query") ?? "").trim();
  const honeypot = String(formData.get("company_website") ?? "").trim();

  if (honeypot) {
    return { status: "not_found", mode: null, items: [] };
  }

  if (query.length < 3 || query.length > 120) {
    return { status: "invalid", mode: null, items: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pa1_2_company_lookup", {
    p_query: query,
  });

  if (error || !data || typeof data !== "object") {
    return { status: "error", mode: null, items: [] };
  }

  const payload = data as {
    ok?: boolean;
    code?: string;
    mode?: "name" | "vat" | null;
    items?: PublicCompanyLookupItem[];
  };

  if (!payload.ok && payload.code === "invalid_query") {
    return { status: "invalid", mode: payload.mode ?? null, items: [] };
  }

  if (!payload.ok) {
    return { status: "error", mode: payload.mode ?? null, items: [] };
  }

  const items = Array.isArray(payload.items) ? payload.items.slice(0, 5) : [];

  return {
    status: payload.code === "not_found" || items.length === 0 ? "not_found" : "ok",
    mode: payload.mode ?? null,
    items,
  };
}
