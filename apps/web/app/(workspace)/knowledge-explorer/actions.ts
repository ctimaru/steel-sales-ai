"use server";

import { createClient } from "@/lib/supabase/server";

export type MatchedEntity = {
  entity_id: string;
  entity_type: string;
  canonical_name: string;
};

export type KnowledgeSearchResult = {
  chunk_id: string;
  source_id: string;
  document_id: string;
  content: string;
  language_code: string | null;
  title: string | null;
  filename: string | null;
  document_type: string | null;
  source_name: string | null;
  source_class: string | null;
  source_uri: string | null;
  page_start: number | null;
  page_end: number | null;
  section_path: string[] | null;
  source_locator: Record<string, unknown> | null;
  chunk_metadata: Record<string, unknown> | null;
  vector_similarity: number | null;
  lexical_score: number | null;
  entity_match_count: number;
  rrf_score: number;
  matched_entities: MatchedEntity[];
};

export type KnowledgeSearchState = {
  status: "idle" | "success" | "error";
  message: string;
  query?: string;
  count?: number;
  results?: KnowledgeSearchResult[];
  model?: {
    model_key: string;
    model_name: string;
    dimensions: number;
  };
  retrieval?: {
    strategy: string;
    match_count: number;
    candidate_count: number;
    rrf_k: number;
    entity_filters: Record<string, string[]>;
    commercial_filters: Record<string, string | number>;
  };
};

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(formData: FormData, key: string) {
  const raw = textValue(formData, key);
  if (!raw) return undefined;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function listValue(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value ? [value] : [];
}

export async function searchKnowledge(
  _previousState: KnowledgeSearchState,
  formData: FormData,
): Promise<KnowledgeSearchState> {
  const query = textValue(formData, "query");
  if (query.length < 2) {
    return {
      status: "error",
      message: "Inserisci almeno 2 caratteri per la ricerca.",
    };
  }

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!configured) {
    return {
      status: "error",
      message: "Knowledge Explorer richiede Supabase Auth configurato.",
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!ownerId) {
    return {
      status: "error",
      message: "Sessione scaduta. Accedi di nuovo.",
    };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return {
      status: "error",
      message: "Worker non configurato nell'ambiente web.",
    };
  }

  const role = textValue(formData, "item_role");
  const allowedRoles = new Set(["requested", "offered", "ordered", "delivered"]);
  const entityFilters = {
    company: listValue(formData, "company"),
    grade: listValue(formData, "grade"),
    standard: listValue(formData, "standard"),
    product_family: listValue(formData, "product_family"),
    country: listValue(formData, "country"),
  };
  const commercialFilters: Record<string, string | number> = {};
  if (allowedRoles.has(role)) commercialFilters.item_role = role;

  const dimensions = [
    ["outer_diameter_mm", positiveNumber(formData, "outer_diameter_mm")],
    ["width_mm", positiveNumber(formData, "width_mm")],
    ["height_mm", positiveNumber(formData, "height_mm")],
    ["thickness_mm", positiveNumber(formData, "thickness_mm")],
    ["length_mm", positiveNumber(formData, "length_mm")],
  ] as const;
  for (const [key, value] of dimensions) {
    if (value !== undefined) commercialFilters[key] = value;
  }

  const limitRaw = Number(textValue(formData, "limit") || "12");
  const limit = [10, 12, 20, 30].includes(limitRaw) ? limitRaw : 12;

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) {
    headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  }

  try {
    const response = await fetch(`${workerUrl}/v1/knowledge/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner_id: ownerId,
        query,
        limit,
        candidate_count: Math.max(60, limit * 5),
        infer_item_role: !allowedRoles.has(role),
        entity_filters: entityFilters,
        commercial_filters: commercialFilters,
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          detail?: string;
          query?: string;
          count?: number;
          results?: KnowledgeSearchResult[];
          model?: KnowledgeSearchState["model"];
          retrieval?: KnowledgeSearchState["retrieval"];
        }
      | null;

    if (!response.ok) {
      return {
        status: "error",
        message: payload?.detail ?? "La ricerca semantica non è disponibile.",
        query,
      };
    }

    return {
      status: "success",
      message:
        (payload?.count ?? 0) > 0
          ? "Ricerca completata sul knowledge layer."
          : "Nessun risultato con i criteri selezionati.",
      query: payload?.query ?? query,
      count: payload?.count ?? 0,
      results: payload?.results ?? [],
      model: payload?.model,
      retrieval: payload?.retrieval,
    };
  } catch {
    return {
      status: "error",
      message: "Worker di ricerca non raggiungibile.",
      query,
    };
  }
}
