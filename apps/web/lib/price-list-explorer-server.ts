import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  PriceListCatalogEntry,
  PriceListExplorerItem,
  PriceListPublicNotice,
  PriceListPublicationReadiness,
} from "@/lib/public-price-lists";
import {
  emptyPrivatePricingContext,
  type DiscountProfile,
  type EffectiveDiscount,
  type PrivatePricingContext,
} from "@/lib/private-pricing";
import type {
  PricingSessionLineSnapshot,
  PricingSessionSnapshot,
  PricingSessionSummary,
} from "@/lib/pricing-session";

export async function listPriceListsForRequest(includeInternal = false) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_price_list_catalog", {
    p_include_internal: includeInternal,
  });

  if (error) {
    console.error("PL1 request catalogue failed:", error.message);
    return [] as PriceListCatalogEntry[];
  }

  return Array.isArray(data) ? (data as PriceListCatalogEntry[]) : [];
}

export async function getPriceListExplorerVersion(
  versionId: string,
  includeInternal = false,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_price_list_explorer_version", {
    p_version_id: versionId,
    p_include_internal: includeInternal,
  });

  if (error) {
    console.error("PL1 explorer version failed:", error.message);
    return null;
  }

  const rows = Array.isArray(data) ? (data as PriceListCatalogEntry[]) : [];
  return rows[0] ?? null;
}

export async function getPriceListExplorerItems(
  versionId: string,
  includeInternal = false,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_price_list_explorer_items", {
    p_version_id: versionId,
    p_include_internal: includeInternal,
  });

  if (error) {
    console.error("PL1 explorer items failed:", error.message);
    return [] as PriceListExplorerItem[];
  }

  return Array.isArray(data) ? (data as PriceListExplorerItem[]) : [];
}


export async function getPrivateLabPriceListExplorerVersion(
  versionId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_private_lab_explorer_version", {
    p_version_id: versionId,
  });

  if (error) {
    console.error("NOV1.2 private lab version failed:", error.message);
    return null;
  }

  const rows = Array.isArray(data) ? (data as PriceListCatalogEntry[]) : [];
  return rows[0] ?? null;
}

export async function getPrivateLabPriceListExplorerItems(
  versionId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_private_lab_explorer_items", {
    p_version_id: versionId,
  });

  if (error) {
    console.error("NOV1.2 private lab items failed:", error.message);
    return [] as PriceListExplorerItem[];
  }

  return Array.isArray(data) ? (data as PriceListExplorerItem[]) : [];
}


export async function getPrivatePricingContext(
  versionId: string,
): Promise<PrivatePricingContext> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) return emptyPrivatePricingContext;

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id,role,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    console.error("PL1.7 membership lookup failed:", membershipError.message);
    return {
      ...emptyPrivatePricingContext,
      authenticated: true,
    };
  }

  const membership =
    memberships?.find((row) => row.is_default) ??
    memberships?.[0] ??
    null;

  if (!membership) {
    return {
      ...emptyPrivatePricingContext,
      authenticated: true,
    };
  }

  const [{ data: organization }, profilesResult, effectiveResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name")
        .eq("id", membership.organization_id)
        .maybeSingle(),
      supabase.rpc("pl1_discount_profiles_for_version", {
        p_version_id: versionId,
      }),
      supabase.rpc("pl1_effective_discounts_for_version", {
        p_version_id: versionId,
      }),
    ]);

  if (profilesResult.error) {
    console.error("PL1.7 profile lookup failed:", profilesResult.error.message);
  }
  if (effectiveResult.error) {
    console.error("PL1.7 effective discount lookup failed:", effectiveResult.error.message);
  }

  return {
    authenticated: true,
    canWrite: membership.role === "admin" || membership.role === "member",
    canManageOrganization: membership.role === "admin",
    organizationName: organization?.name ?? null,
    profiles: Array.isArray(profilesResult.data)
      ? (profilesResult.data as DiscountProfile[])
      : [],
    effectiveDiscounts: Array.isArray(effectiveResult.data)
      ? (effectiveResult.data as EffectiveDiscount[])
      : [],
  };
}


export async function getPricingSessionHistory(limit = 50) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return {
      authenticated: false,
      sessions: [] as PricingSessionSummary[],
    };
  }

  const { data, error } = await supabase
    .from("pricing_sessions")
    .select(
      "id,title,price_list_version_id,pricing_mode,currency_code,list_name_snapshot,list_code_snapshot,manufacturer_version_snapshot,source_date_snapshot,line_count,total_meters,total_tonnes,total_value,weighted_average_eur_t,weighted_average_status,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) {
    console.error("PL1.11 history lookup failed:", error.message);
    return {
      authenticated: true,
      sessions: [] as PricingSessionSummary[],
    };
  }

  return {
    authenticated: true,
    sessions: Array.isArray(data) ? (data as PricingSessionSummary[]) : [],
  };
}

export async function getPricingSessionSnapshot(
  sessionId: string,
): Promise<{ authenticated: boolean; session: PricingSessionSnapshot | null }> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { authenticated: false, session: null };
  }

  const { data: session, error: sessionError } = await supabase
    .from("pricing_sessions")
    .select(
      "id,title,price_list_version_id,pricing_mode,currency_code,pricing_formula,manual_discount_pct,target_eur_t,list_name_snapshot,list_code_snapshot,manufacturer_version_snapshot,manufacturer_revision_snapshot,source_date_snapshot,line_count,total_meters,total_tonnes,total_value,weighted_average_eur_t,weighted_average_status,meters_complete,tonnes_complete,value_complete,created_at",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    if (sessionError) {
      console.error("PL1.11 session lookup failed:", sessionError.message);
    }
    return { authenticated: true, session: null };
  }

  const { data: lines, error: linesError } = await supabase
    .from("pricing_session_lines")
    .select(
      "id,line_position,price_list_item_id,dimension_label_snapshot,shape_code_snapshot,standard_code_snapshot,grade_code_snapshot,finish_code_snapshot,thickness_mm_snapshot,note_snapshot,quantity_mode,quantity,bar_length_m,line_meters,weight_kg_m_snapshot,line_tonnes,base_eur_m_snapshot,fixed_extra_eur_m_snapshot,applied_discount_pct,discount_source,discount_profile_id,net_eur_m,net_eur_t,line_total,price_per_t_ready_snapshot,price_per_t_status_snapshot",
    )
    .eq("session_id", sessionId)
    .order("line_position", { ascending: true });

  if (linesError) {
    console.error("PL1.11 session lines lookup failed:", linesError.message);
    return { authenticated: true, session: null };
  }

  return {
    authenticated: true,
    session: {
      ...(session as Omit<PricingSessionSnapshot, "lines">),
      lines: Array.isArray(lines)
        ? (lines as PricingSessionLineSnapshot[])
        : [],
    },
  };
}


export async function getPriceListPublicNotices(
  versionId: string,
  includeInternal = false,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_price_list_public_notices", {
    p_version_id: versionId,
    p_include_internal: includeInternal,
  });

  if (error) {
    console.error("PP1 public notice lookup failed:", error.message);
    return [] as PriceListPublicNotice[];
  }

  return Array.isArray(data) ? (data as PriceListPublicNotice[]) : [];
}

export async function getPriceListPublicationReadiness(versionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_publication_readiness", {
    p_version_id: versionId,
  });

  if (error) {
    console.error("PP1 readiness lookup failed:", error.message);
    return null;
  }

  return (data ?? null) as PriceListPublicationReadiness | null;
}
