"use server";

import { createClient } from "@/lib/supabase/server";

export type ProductPrice = {
  value: number | null;
  unit: string | null;
  currency: string | null;
  at: string | null;
  thread_id?: string | null;
  thread_subject?: string | null;
  observation_id?: number | null;
  quantity?: number | null;
  quantity_unit?: string | null;
  source_filename?: string | null;
  source_text?: string | null;
  company?: ProductCounterparty | null;
};

export type ProductCatalogItem = {
  canonical_product_id: string;
  canonical_product_key: string;
  product_type: string | null;
  grade: string | null;
  standard: string | null;
  material_number: string | null;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number | null;
  observed_lengths_mm: number[];
  event_count: number;
  requested_count: number;
  offered_count: number;
  ordered_count: number;
  delivered_count: number;
  thread_count: number;
  first_event_at: string | null;
  latest_event_at: string | null;
  latest_price: ProductPrice | null;
};

export type ProductCounterparty = {
  id?: string | null;
  company_id?: string | null;
  name?: string | null;
  company_name?: string | null;
  type?: string | null;
  company_type?: string | null;
  country?: string | null;
  company_country?: string | null;
  event_count?: number;
  latest_event_at?: string | null;
};

export type ProductTimelineEvent = {
  observation_id: number;
  item_role: string | null;
  direction: string | null;
  event_type: string;
  commercial_at: string | null;
  thread_id: string;
  thread_subject: string | null;
  thread_classification: string | null;
  quantity: number | null;
  quantity_unit: string | null;
  price_value: number | null;
  price_unit: string | null;
  currency: string | null;
  availability_status: string | null;
  source_filename: string | null;
  source_text: string | null;
  confidence: number | null;
  company_id: string | null;
  company_name: string | null;
  company_type: string | null;
  company_country: string | null;
};

export type ProductDocument = {
  source_filename: string;
  observation_count: number;
  latest_event_at: string | null;
  roles: string[];
  sample_thread_id: string | null;
};

export type Product360Payload = {
  found: boolean;
  product?: {
    canonical_product_id: string;
    canonical_product_key: string;
    product_type: string | null;
    grade: string | null;
    standard: string | null;
    material_number: string | null;
    outer_diameter_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
    thickness_mm: number | null;
    observed_lengths_mm: number[];
  } | null;
  summary?: {
    event_count: number;
    requested_count: number;
    offered_count: number;
    ordered_count: number;
    delivered_count: number;
    thread_count: number;
    first_event_at: string | null;
    latest_event_at: string | null;
  } | null;
  latest_price?: ProductPrice | null;
  price_history?: ProductPrice[];
  price_stats?: Array<{
    currency: string;
    price_unit: string;
    sample_count: number;
    min_price: number;
    max_price: number;
    avg_price: number;
    first_price_at: string | null;
    latest_price_at: string | null;
  }>;
  timeline?: ProductTimelineEvent[];
  counterparties?: ProductCounterparty[];
  documents?: ProductDocument[];
  access?: { membership_verified?: boolean; role?: string | null } | null;
};

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

async function actorUserId(): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return !error && data.user?.id ? data.user.id : null;
}

async function workerCall<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) throw new Error("Worker non configurato nell'ambiente web.");
  const headers: HeadersInit = { "content-type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  const response = await fetch(`${workerUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as (T & { detail?: string }) | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.detail ?? "Product 360 non disponibile.");
  }
  return payload;
}

export async function loadProductCatalog(query?: string): Promise<{
  total: number;
  results: ProductCatalogItem[];
  error?: string;
}> {
  if (!supabaseConfigured()) {
    return {
      total: 0,
      results: [],
      error: "Product 360 non è disponibile in modalità demo: collega Supabase per interrogare la Commercial Memory.",
    };
  }
  const actor = await actorUserId();
  if (!actor) return { total: 0, results: [], error: "Sessione non valida o scaduta." };
  try {
    const payload = await workerCall<{ total?: number; results?: ProductCatalogItem[] }>("/v1/products", {
      actor_user_id: actor,
      query: query?.trim() || undefined,
      limit: 120,
    });
    return { total: payload.total ?? 0, results: payload.results ?? [] };
  } catch (error) {
    return { total: 0, results: [], error: error instanceof Error ? error.message : "Product catalog non disponibile." };
  }
}

export async function loadProduct360(productId: string): Promise<Product360Payload & { error?: string }> {
  if (!supabaseConfigured()) {
    return {
      found: false,
      error: "Product 360 non è disponibile in modalità demo: collega Supabase per interrogare la Commercial Memory.",
    };
  }
  const actor = await actorUserId();
  if (!actor) return { found: false, error: "Sessione non valida o scaduta." };
  try {
    return await workerCall<Product360Payload>(`/v1/products/${encodeURIComponent(productId)}`, {
      actor_user_id: actor,
      limit: 250,
    });
  } catch (error) {
    return { found: false, error: error instanceof Error ? error.message : "Product 360 non disponibile." };
  }
}
