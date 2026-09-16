"use server";

import { createClient } from "@/lib/supabase/server";

export type GlobalResultType =
  | "document"
  | "company"
  | "product"
  | "rfq"
  | "offer"
  | "order"
  | "delivery";

export type GlobalSearchResult = {
  result_type: GlobalResultType;
  result_id: string;
  title: string;
  subtitle: string | null;
  snippet: string | null;
  event_at: string | null;
  role: string | null;
  grade: string | null;
  standard: string | null;
  product_type: string | null;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number | null;
  length_mm: number | null;
  quantity: number | null;
  quantity_unit: string | null;
  price_value: number | null;
  price_unit: string | null;
  currency: string | null;
  source_filename: string | null;
  thread_id: string | null;
  score: number;
  metadata: Record<string, unknown>;
};

export type GlobalSearchState = {
  status: "idle" | "success" | "error";
  message: string;
  query?: string;
  count?: number;
  counts?: Record<string, number>;
  results?: GlobalSearchResult[];
  filters?: Record<string, unknown>;
  model?: { model_key: string; model_name: string; dimensions: number } | null;
};

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned || undefined;
}

function positive(formData: FormData, key: string): number | undefined {
  const raw = text(formData, key);
  if (!raw) return undefined;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function nonNegative(formData: FormData, key: string): number | undefined {
  const raw = text(formData, key);
  if (!raw) return undefined;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export async function globalSearch(
  _previous: GlobalSearchState,
  formData: FormData,
): Promise<GlobalSearchState> {
  const query = text(formData, "query") ?? "";
  if (query.length < 2) {
    return { status: "error", message: "Inserisci almeno 2 caratteri per la ricerca." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const actorUserId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!actorUserId) {
    return { status: "error", message: "Sessione scaduta. Accedi di nuovo." };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return { status: "error", message: "Worker non configurato nell'ambiente web." };
  }

  const allowedTypes = new Set<GlobalResultType>([
    "document",
    "company",
    "product",
    "rfq",
    "offer",
    "order",
    "delivery",
  ]);
  const types = formData
    .getAll("types")
    .filter((value): value is GlobalResultType => typeof value === "string" && allowedTypes.has(value as GlobalResultType));

  const role = text(formData, "item_role");
  const filters = Object.fromEntries(
    Object.entries({
      company: text(formData, "company"),
      grade: text(formData, "grade"),
      standard: text(formData, "standard"),
      product_family: text(formData, "product_family"),
      item_role: ["requested", "offered", "ordered", "delivered"].includes(role ?? "") ? role : undefined,
      outer_diameter_mm: positive(formData, "outer_diameter_mm"),
      width_mm: positive(formData, "width_mm"),
      height_mm: positive(formData, "height_mm"),
      thickness_mm: positive(formData, "thickness_mm"),
      length_mm: positive(formData, "length_mm"),
      price_min: nonNegative(formData, "price_min"),
      price_max: nonNegative(formData, "price_max"),
      currency: text(formData, "currency")?.toUpperCase(),
      source: text(formData, "source"),
      source_class: text(formData, "source_class"),
      source_type: text(formData, "source_type"),
      document_type: text(formData, "document_type"),
      date_from: text(formData, "date_from"),
      date_to: text(formData, "date_to"),
    }).filter((entry) => entry[1] !== undefined),
  );

  const headers: HeadersInit = { "content-type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;

  try {
    const response = await fetch(`${workerUrl}/v1/global-search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        actor_user_id: actorUserId,
        query,
        types,
        filters,
        limit: 40,
      }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          detail?: string;
          query?: string;
          count?: number;
          counts?: Record<string, number>;
          results?: GlobalSearchResult[];
          filters?: Record<string, unknown>;
          model?: GlobalSearchState["model"];
        }
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: payload?.detail ?? "Global Search non disponibile.",
        query,
      };
    }

    return {
      status: "success",
      message: (payload?.count ?? 0) ? "Ricerca completata." : "Nessun risultato con i criteri selezionati.",
      query: payload?.query ?? query,
      count: payload?.count ?? 0,
      counts: payload?.counts ?? {},
      results: payload?.results ?? [],
      filters: payload?.filters ?? filters,
      model: payload?.model ?? null,
    };
  } catch {
    return { status: "error", message: "Worker Global Search non raggiungibile.", query };
  }
}
