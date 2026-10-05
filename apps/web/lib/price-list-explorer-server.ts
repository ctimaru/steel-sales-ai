import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  PriceListCatalogEntry,
  PriceListExplorerItem,
} from "@/lib/public-price-lists";
import {
  emptyPrivatePricingContext,
  type DiscountProfile,
  type EffectiveDiscount,
  type PrivatePricingContext,
} from "@/lib/private-pricing";

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
