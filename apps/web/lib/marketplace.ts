import { createClient } from "@/lib/supabase/server";

export type MarketplaceRequestSummary = {
  id: string;
  title: string;
  visibility_mode: "named" | "anonymous";
  status: "draft" | "published" | "withdrawn";
  effective_status: "draft" | "open" | "closing_soon" | "closed" | "withdrawn";
  opens_at: string | null;
  closes_at: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
  line_count: number;
};

export type MarketplaceRequestLine = {
  id: string;
  line_number: number;
  product_family_id: string;
  product_family_key: string;
  product_family_name: string;
  standard_id: string | null;
  standard_code: string | null;
  standard_title: string | null;
  material_grade_id: string | null;
  grade_designation: string | null;
  material_number: string | null;
  manufacturing_process: string | null;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number | null;
  length_mm: number | null;
  quantity: number;
  quantity_unit: string;
  certification: string | null;
  delivery_country_code: string;
  delivery_region: string | null;
  requested_delivery_date: string | null;
  notes: string | null;
  created_at: string;
};

export type MarketplaceRequestDetail = {
  contract: string;
  request: Omit<MarketplaceRequestSummary, "line_count"> & {
    organization_id: string;
  };
  lines: MarketplaceRequestLine[];
};

export type MarketplaceTaxonomy = {
  contract: string;
  product_families: { id: string; key: string; name: string }[];
  standards: {
    id: string;
    code: string;
    title: string;
    manufacturing_processes: string[];
    product_family_keys: string[];
  }[];
  grades: {
    standard_id: string;
    standard_code: string;
    material_grade_id: string;
    designation: string;
    material_number: string | null;
  }[];
};

export async function getMyMarketplaceRequests(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_1_my_requests", {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as { items?: MarketplaceRequestSummary[] };
  return payload.items ?? [];
}

export async function getMarketplaceRequest(requestId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_1_my_request", {
    p_request_id: requestId,
  });
  if (error) {
    if (error.code === "P0002") return null;
    throw new Error(error.message);
  }
  return (data as MarketplaceRequestDetail | null) ?? null;
}

export async function getMarketplaceTaxonomy() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_1_listing_taxonomy");
  if (error) throw new Error(error.message);
  return (data ?? {
    contract: "P5.1-taxonomy-v1",
    product_families: [],
    standards: [],
    grades: [],
  }) as MarketplaceTaxonomy;
}

export type MarketplaceFeedTeaserLine = {
  line_number: number;
  product_family_key: string;
  product_family_name: string;
  manufacturing_process?: string;
  quantity_band: string;
  delivery_country_code: string;
  delivery_region?: string;
  has_standard: boolean;
  has_grade: boolean;
  has_dimensions: boolean;
  has_certification: boolean;
};

export type MarketplaceFeedBuyer =
  | {
      visibility_mode: "anonymous";
    }
  | {
      visibility_mode: "named";
      network_company_id?: string;
      display_name?: string;
      country_code?: string;
      verification_status?: string;
      claimed_status?: string;
      profile_available?: boolean;
    };

export type MarketplaceFeedItem = {
  request_id: string;
  visibility_mode: "named" | "anonymous";
  effective_status: "open" | "closing_soon";
  opens_at: string;
  closes_at: string;
  seconds_remaining: number;
  buyer: MarketplaceFeedBuyer;
  line_count: number;
  teaser_lines: MarketplaceFeedTeaserLine[];
};

export type MarketplaceFeedResponse = {
  contract: "P5.2-feed-v1";
  generated_at: string;
  items: MarketplaceFeedItem[];
  total: number;
  limit: number;
  offset: number;
};

export async function getMarketplaceFeed(
  viewerOrganizationId: string,
  filters?: {
    productKey?: string;
    countryCode?: string;
    closingWithinHours?: number;
    limit?: number;
    offset?: number;
  },
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_2_marketplace_feed", {
    p_viewer_organization_id: viewerOrganizationId,
    p_product_keys: filters?.productKey ? [filters.productKey] : null,
    p_country_codes: filters?.countryCode
      ? [filters.countryCode.toUpperCase()]
      : null,
    p_closing_within_hours: filters?.closingWithinHours ?? null,
    p_limit: filters?.limit ?? 25,
    p_offset: filters?.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? {
    contract: "P5.2-feed-v1",
    generated_at: new Date().toISOString(),
    items: [],
    total: 0,
    limit: filters?.limit ?? 25,
    offset: filters?.offset ?? 0,
  }) as MarketplaceFeedResponse;
}

export async function getMarketplaceTeaser(
  viewerOrganizationId: string,
  requestId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_2_marketplace_teaser", {
    p_viewer_organization_id: viewerOrganizationId,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  return (data as MarketplaceFeedItem | null) ?? null;
}

export type MarketplaceEntitlementState = {
  contract: "P5.3-entitlement-v1";
  request_id: string;
  state: "locked" | "entitled" | "expired";
  can_view_locked_detail: boolean;
  can_respond: false;
  entitlement_key: "marketplace_access" | "opportunity_unlock" | null;
  source_kind: "subscription" | "credit" | "manual" | "pilot" | "system" | null;
  expires_at: string | null;
};

export type MarketplaceUnlockedLine = {
  line_number: number;
  product_family_key: string;
  product_family_name: string;
  standard_code?: string;
  standard_title?: string;
  grade_designation?: string;
  material_number?: string;
  manufacturing_process?: string;
  outer_diameter_mm?: number;
  width_mm?: number;
  height_mm?: number;
  thickness_mm?: number;
  length_mm?: number;
  quantity: number;
  quantity_unit: string;
  certification?: string;
  delivery_country_code: string;
  delivery_region?: string;
  requested_delivery_date?: string;
  notes?: string;
  notes_withheld_for_anonymity: boolean;
};

export type MarketplaceUnlockedDetail = {
  contract: "P5.3-detail-v1";
  request: {
    request_id: string;
    visibility_mode: "named" | "anonymous";
    effective_status: "open" | "closing_soon";
    opens_at: string;
    closes_at: string;
    seconds_remaining: number;
  };
  buyer: MarketplaceFeedBuyer;
  entitlement: MarketplaceEntitlementState;
  lines: MarketplaceUnlockedLine[];
  can_respond: false;
};

export async function getMarketplaceEntitlementState(
  supplierOrganizationId: string,
  requestId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_3_entitlement_state", {
    p_supplier_organization_id: supplierOrganizationId,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  return (data as MarketplaceEntitlementState | null) ?? null;
}

export async function getMarketplaceUnlockedDetail(
  supplierOrganizationId: string,
  requestId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_3_marketplace_detail", {
    p_supplier_organization_id: supplierOrganizationId,
    p_request_id: requestId,
  });

  if (error) {
    if (error.code === "42501") return null;
    throw new Error(error.message);
  }

  return (data as MarketplaceUnlockedDetail | null) ?? null;
}

export type MarketplaceResponseStatus =
  | "draft"
  | "submitted"
  | "withdrawn"
  | "declined"
  | "acknowledged"
  | "closed";

export type MarketplaceResponseRights = {
  contract: "P5.4-response-rights-v1";
  request_id: string;
  state: "eligible" | "ineligible" | MarketplaceResponseStatus;
  reason: string;
  can_create: boolean;
  can_edit: boolean;
  can_submit: boolean;
  can_withdraw: boolean;
  response_id: string | null;
  response_status: MarketplaceResponseStatus | null;
  entitlement_key?: "marketplace_access" | "opportunity_unlock";
  entitlement_source?: "subscription" | "credit" | "manual" | "pilot" | "system";
};

export type MarketplaceResponseRequestLine = {
  request_line_id: string;
  line_number: number;
  quantity: number;
  quantity_unit: string;
};

export type MarketplaceSupplierResponseLine = {
  request_line_id: string;
  line_number: number;
  offered_quantity?: number;
  quantity_unit?: string;
  unit_price?: number;
  currency_code?: string;
  lead_time_days?: number;
  offered_delivery_date?: string;
  notes?: string;
};

export type MarketplaceSupplierResponse = {
  response_id: string;
  request_id: string;
  response_kind: "interest" | "quote";
  status: MarketplaceResponseStatus;
  message: string | null;
  valid_until: string | null;
  submitted_at: string | null;
  withdrawn_at: string | null;
  decided_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  buyer_visibility_mode: "named" | "anonymous";
  lines: MarketplaceSupplierResponseLine[];
};

export type MarketplaceSupplierWorkspace = {
  contract: "P5.4-supplier-workspace-v1";
  request_id: string;
  rights: MarketplaceResponseRights;
  request_lines: MarketplaceResponseRequestLine[];
  response: MarketplaceSupplierResponse | null;
};

export async function getMarketplaceSupplierWorkspace(
  supplierOrganizationId: string,
  requestId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_4_supplier_workspace", {
    p_supplier_organization_id: supplierOrganizationId,
    p_request_id: requestId,
  });
  if (error) {
    if (error.code === "P0002") return null;
    throw new Error(error.message);
  }
  return (data as MarketplaceSupplierWorkspace | null) ?? null;
}

export type MarketplaceSupplierIdentity = {
  network_company_id?: string;
  display_name: string;
  country_code?: string;
  verification_status?: string;
  claimed_status?: string;
  profile_available?: boolean;
};

export type MarketplaceBuyerResponseInboxItem = {
  response_id: string;
  request_id: string;
  request_title: string;
  request_visibility_mode: "named" | "anonymous";
  response_kind: "interest" | "quote";
  status: Exclude<MarketplaceResponseStatus, "draft">;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  line_count: number;
  supplier: MarketplaceSupplierIdentity;
};

export type MarketplaceBuyerResponseInbox = {
  contract: "P5.4-buyer-inbox-v1";
  items: MarketplaceBuyerResponseInboxItem[];
  total: number;
  limit: number;
  offset: number;
};

export async function getMarketplaceBuyerResponses(
  buyerOrganizationId: string,
  requestId?: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_4_buyer_inbox", {
    p_buyer_organization_id: buyerOrganizationId,
    p_request_id: requestId ?? null,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? {
    contract: "P5.4-buyer-inbox-v1",
    items: [],
    total: 0,
    limit: 100,
    offset: 0,
  }) as MarketplaceBuyerResponseInbox;
}

export type MarketplaceBuyerResponseDetail = {
  contract: "P5.4-buyer-response-detail-v1";
  response: {
    response_id: string;
    request_id: string;
    response_kind: "interest" | "quote";
    status: Exclude<MarketplaceResponseStatus, "draft">;
    message: string | null;
    valid_until: string | null;
    submitted_at: string | null;
    withdrawn_at: string | null;
    decided_at: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  request: {
    request_id: string;
    title: string;
    visibility_mode: "named" | "anonymous";
    status: "draft" | "published" | "withdrawn";
    closes_at: string | null;
  };
  supplier: MarketplaceSupplierIdentity;
  lines: Array<{
    request_line_id: string;
    line_number: number;
    product_family_key: string;
    product_family_name: string;
    request_quantity: number;
    request_quantity_unit: string;
    offered_quantity?: number;
    quantity_unit?: string;
    unit_price?: number;
    currency_code?: string;
    lead_time_days?: number;
    offered_delivery_date?: string;
    notes?: string;
  }>;
};

export async function getMarketplaceBuyerResponse(
  buyerOrganizationId: string,
  responseId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_4_buyer_response_detail", {
    p_buyer_organization_id: buyerOrganizationId,
    p_response_id: responseId,
  });
  if (error) throw new Error(error.message);
  return (data as MarketplaceBuyerResponseDetail | null) ?? null;
}

export type MarketplaceMatchBand = "strong" | "good" | "broad";

export type MarketplaceMatchLine = {
  line_number: number;
  score: number;
  band: MarketplaceMatchBand;
  relationship_type: string;
  criteria_count: number;
  exact_count: number;
  unknown_count: number;
  reason_codes: string[];
};

export type MarketplaceNotificationItem = {
  notification_id: string;
  status: "unread" | "read";
  created_at: string;
  request_id: string;
  closes_at: string;
  match: {
    match_id: string;
    score: number;
    band: MarketplaceMatchBand;
    matched_line_count: number;
    total_line_count: number;
    algorithm_version: "P5.5-v1";
    lines: MarketplaceMatchLine[];
  };
  teaser: MarketplaceFeedItem;
  response_status: MarketplaceResponseStatus | null;
};

export type MarketplaceNotificationsResponse = {
  contract: "P5.5-notifications-v1";
  generated_at: string;
  items: MarketplaceNotificationItem[];
  total: number;
  unread: number;
  limit: number;
  offset: number;
};

export async function getMarketplaceNotifications(
  recipientOrganizationId: string,
  options?: { limit?: number; offset?: number },
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_5_my_notifications", {
    p_recipient_organization_id: recipientOrganizationId,
    p_limit: options?.limit ?? 50,
    p_offset: options?.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? {
    contract: "P5.5-notifications-v1",
    generated_at: new Date().toISOString(),
    items: [],
    total: 0,
    unread: 0,
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
  }) as MarketplaceNotificationsResponse;
}

export type MarketplaceBuyerMatchSummary = {
  contract: "P5.5-buyer-match-summary-v1";
  request_id: string;
  algorithm_version: "P5.5-v1";
  total_matches: number;
  contactable_matches: number;
  notifications_created: number;
  bands: {
    strong: number;
    good: number;
    broad: number;
  };
};

export async function getMarketplaceBuyerMatchSummary(
  buyerOrganizationId: string,
  requestId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p5_5_buyer_match_summary", {
    p_buyer_organization_id: buyerOrganizationId,
    p_request_id: requestId,
  });
  if (error) {
    if (error.code === "P0002") return null;
    throw new Error(error.message);
  }
  return (data as MarketplaceBuyerMatchSummary | null) ?? null;
}
