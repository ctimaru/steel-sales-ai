"use server";

import { createClient } from "@/lib/supabase/server";

export type CompanyDirectoryItem = {
  company_id: string;
  name: string;
  company_type: string | null;
  country: string | null;
  vat_number: string | null;
  website: string | null;
  verified: boolean;
  contact_count: number;
  message_count: number;
  rfq_count: number;
  offer_count: number;
  order_count: number;
  last_activity_at: string | null;
};

export type CompanyDirectoryPayload = {
  total: number;
  companies: CompanyDirectoryItem[];
  error?: string;
};

export type Company360Payload = {
  company: {
    company_id: string;
    name: string;
    company_type: string | null;
    country: string | null;
    vat_number: string | null;
    website: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    verified: boolean;
  };
  summary: {
    contacts: number;
    conversations: number;
    messages: number;
    rfqs: number;
    offers: number;
    orders: number;
    priced_lines: number;
    products: number;
  };
  verifications: Array<{
    verification_id: number;
    identity_type: string;
    identity_value: string;
    verification_basis: string;
    verified_at: string;
    metadata: Record<string, unknown>;
  }>;
  contacts: Array<{
    contact_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    created_at: string;
    message_count: number;
    rfq_count: number;
  }>;
  conversations: Array<{
    conversation_id: string;
    subject: string | null;
    status: string | null;
    external_thread_id: string | null;
    started_at: string | null;
    last_activity_at: string | null;
    message_count: number;
  }>;
  messages: Array<{
    message_id: string;
    conversation_id: string | null;
    external_message_id: string | null;
    direction: string | null;
    sender_email: string | null;
    recipient_emails: string[];
    sent_at: string | null;
    subject: string | null;
    classification: string | null;
    sender_contact_id: string | null;
    sender_company_id: string | null;
    provenance: Record<string, unknown>;
  }>;
  rfqs: Array<{
    rfq_id: string;
    status: string;
    priority: string;
    requested_at: string | null;
    due_at: string | null;
    contact_id: string | null;
    conversation_id: string | null;
    source_message_id: string | null;
    assigned_to_user_id: string | null;
    lines: Array<{
      rfq_line_id: string;
      quantity: number | null;
      quantity_unit: string | null;
      grade: string | null;
      standard: string | null;
      length_mm: number | null;
      canonical_product_id: string | null;
      canonical_product_key: string | null;
      raw_spec_text: string | null;
      source_observation_id: number | null;
    }>;
    provenance: Record<string, unknown>;
  }>;
  offers: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  product_activity: Array<{
    canonical_product_id: string | null;
    canonical_product_key: string | null;
    activity_count: number;
    rfq_count: number;
    offer_count: number;
    order_count: number;
    last_activity_at: string | null;
    last_grade: string | null;
    last_standard: string | null;
    last_raw_spec_text: string | null;
  }>;
  price_activity: Array<{
    activity_type: string;
    business_id: string;
    event_at: string | null;
    canonical_product_id: string | null;
    canonical_product_key: string | null;
    quantity: number | null;
    quantity_unit: string | null;
    price_value: number;
    price_unit: string | null;
    currency: string | null;
    source_observation_id: number | null;
  }>;
  timeline: Array<{
    event_type: string;
    event_id: string;
    event_at: string | null;
    title: string;
    status: string | null;
    contact_id: string | null;
    source_message_id: string | null;
    provenance: Record<string, unknown>;
  }>;
  read_model: "normalized_company_360";
};

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

async function activeOrganizationId() {
  if (!configured()) return { client: null, organizationId: null, error: "Dati non configurati." };

  const client = await createClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return { client: null, organizationId: null, error: "Sessione non valida." };
  }

  const { data: memberships } = await client
    .from("organization_memberships")
    .select("organization_id,is_default,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0];
  if (!membership) {
    return { client: null, organizationId: null, error: "Workspace non disponibile." };
  }

  return { client, organizationId: membership.organization_id as string, error: null };
}

export async function loadCompanyDirectory(query?: string): Promise<CompanyDirectoryPayload> {
  const context = await activeOrganizationId();
  if (!context.client || !context.organizationId) {
    return { total: 0, companies: [], error: context.error ?? "Dati non disponibili." };
  }

  const { data, error } = await context.client.rpc("p1_company_directory", {
    p_organization_id: context.organizationId,
    p_query: query?.trim() || null,
    p_limit: 100,
  });

  if (error || !data || typeof data !== "object") {
    return { total: 0, companies: [], error: "Impossibile caricare le aziende del workspace." };
  }

  const payload = data as { total?: unknown; companies?: unknown };
  return {
    total: Number(payload.total ?? 0),
    companies: Array.isArray(payload.companies) ? payload.companies as CompanyDirectoryItem[] : [],
  };
}

export async function loadCompany360(companyId: string): Promise<{
  found: boolean;
  data: Company360Payload | null;
  error?: string;
}> {
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) {
    return { found: false, data: null };
  }

  const context = await activeOrganizationId();
  if (!context.client) {
    return { found: false, data: null, error: context.error ?? "Dati non disponibili." };
  }

  const { data, error } = await context.client.rpc("p1_company_360", {
    p_company_id: companyId,
  });

  if (error) {
    return { found: false, data: null, error: "Impossibile caricare lo storico dell'azienda." };
  }
  if (!data || typeof data !== "object") {
    return { found: false, data: null };
  }

  return { found: true, data: data as Company360Payload };
}
