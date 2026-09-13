"use server";

import { createClient } from "@/lib/supabase/server";

export type AssistantIntent =
  | "latest_price"
  | "price_history"
  | "offers_without_order"
  | "commercial_search"
  | "market_comparison"
  | "unsupported";

export type AssistantFilters = {
  grade?: string | null;
  outer_diameter_mm?: number | null;
  min_outer_diameter_mm?: number | null;
  max_outer_diameter_mm?: number | null;
  thickness_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  days?: number | null;
  role?: "requested" | "offered" | "ordered" | "delivered" | null;
};

export type AssistantContext = {
  intent: Exclude<AssistantIntent, "unsupported">;
  filters: AssistantFilters;
};

export type AssistantObservation = {
  id: number;
  thread_id: string;
  item_role?: string | null;
  grade: string | null;
  standard: string | null;
  outer_diameter_mm: number | string | null;
  width_mm: number | string | null;
  height_mm: number | string | null;
  thickness_mm: number | string | null;
  length_mm: number | string | null;
  quantity: number | string | null;
  quantity_unit: string | null;
  price_value: number | string | null;
  price_unit: string | null;
  currency: string | null;
  source_text: string | null;
  source_filename: string | null;
  confidence: number | string | null;
  commercial_at?: string | null;
  offered_at?: string | null;
  thread_subject: string | null;
};

export type AssistantMarketSource = {
  key?: string | null;
  name?: string | null;
  provider?: string | null;
  source_url?: string | null;
  unit?: string | null;
  display_unit?: string | null;
  latest_period?: string | null;
  latest_value?: number | null;
};

export type AssistantMarketSummary = {
  price_change_pct?: number | null;
  market_change_same_window_pct?: number | null;
  divergence_pct_points?: number | null;
  market_change_since_latest_offer_pct?: number | null;
  latest_offer_market_period?: string | null;
};

export type AssistantMarketPoint = {
  observation_id?: number | null;
  thread_id?: string | null;
  commercial_at?: string | null;
  price_value?: number | null;
  price_unit?: string | null;
  currency?: string | null;
  market_period?: string | null;
  market_value?: number | null;
  market_change_to_latest_pct?: number | null;
};

export type AssistantMarketContext = {
  source?: AssistantMarketSource | null;
  summary?: AssistantMarketSummary | null;
  points?: AssistantMarketPoint[];
  reference_price_unit?: string | null;
  reference_currency?: string | null;
  comparable_price_count?: number;
};

export type AssistantPayload = {
  intent: AssistantIntent;
  found: boolean;
  answer: string;
  filters: AssistantFilters;
  context?: AssistantContext | null;
  thread_count?: number;
  observations: AssistantObservation[];
  market?: AssistantMarketContext | null;
};

export type AssistantTurn = {
  query: string;
  message: string;
  status: "success" | "error";
  payload?: AssistantPayload | null;
};

export type AssistantState = {
  status: "idle" | "success" | "error";
  query: string;
  message: string;
  payload?: AssistantPayload | null;
  context?: AssistantContext | null;
  turns: AssistantTurn[];
};

function appendTurn(
  previousState: AssistantState,
  turn: AssistantTurn,
): AssistantTurn[] {
  return [...(previousState.turns ?? []), turn].slice(-8);
}

export async function askCommercialAssistant(
  previousState: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  const raw = formData.get("query");
  const query = typeof raw === "string" ? raw.trim() : "";
  if (query.length < 2) {
    const message = "Scrivi una domanda commerciale.";
    return {
      ...previousState,
      status: "error",
      query,
      message,
      turns: appendTurn(previousState, { query, message, status: "error", payload: null }),
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!ownerId) {
    const message = "Sessione scaduta. Accedi di nuovo.";
    return {
      ...previousState,
      status: "error",
      query,
      message,
      turns: appendTurn(previousState, { query, message, status: "error", payload: null }),
    };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    const message = "Worker non configurato nell'ambiente web.";
    return {
      ...previousState,
      status: "error",
      query,
      message,
      turns: appendTurn(previousState, { query, message, status: "error", payload: null }),
    };
  }

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) {
    headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;
  }

  try {
    const response = await fetch(`${workerUrl}/v1/ai/assistant`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner_id: ownerId,
        query,
        context: previousState.context ?? previousState.payload?.context ?? undefined,
      }),
      cache: "no-store",
    });
    const rawPayload = (await response.json().catch(() => null)) as
      | AssistantPayload
      | { detail?: string }
      | null;

    if (!response.ok || !rawPayload || !("answer" in rawPayload)) {
      const message = rawPayload && "detail" in rawPayload && rawPayload.detail
        ? rawPayload.detail
        : "La domanda non è stata elaborata.";
      return {
        ...previousState,
        status: "error",
        query,
        message,
        turns: appendTurn(previousState, { query, message, status: "error", payload: null }),
      };
    }

    const payload: AssistantPayload = {
      ...rawPayload,
      observations: (rawPayload.observations ?? []).slice(0, 12),
    };
    const message = payload.answer;
    const turn: AssistantTurn = { query, message, status: "success", payload };
    return {
      status: "success",
      query,
      message,
      payload,
      context: payload.context ?? previousState.context ?? null,
      turns: appendTurn(previousState, turn),
    };
  } catch {
    const message = "Worker non raggiungibile.";
    return {
      ...previousState,
      status: "error",
      query,
      message,
      turns: appendTurn(previousState, { query, message, status: "error", payload: null }),
    };
  }
}
