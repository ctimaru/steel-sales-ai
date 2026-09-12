"use server";

import { createClient } from "@/lib/supabase/server";

export type AssistantObservation = {
  id: number;
  thread_id: string;
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

export type AssistantPayload = {
  intent: "latest_price" | "price_history" | "offers_without_order" | "unsupported";
  found: boolean;
  answer: string;
  filters: {
    grade?: string | null;
    outer_diameter_mm?: number | null;
    thickness_mm?: number | null;
    width_mm?: number | null;
    height_mm?: number | null;
    days?: number | null;
  };
  thread_count?: number;
  observations: AssistantObservation[];
};

export type AssistantState = {
  status: "idle" | "success" | "error";
  query: string;
  message: string;
  payload?: AssistantPayload | null;
};

export async function askCommercialAssistant(
  _previousState: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  const raw = formData.get("query");
  const query = typeof raw === "string" ? raw.trim() : "";
  if (query.length < 2) {
    return { status: "error", query, message: "Scrivi una domanda commerciale.", payload: null };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!ownerId) {
    return { status: "error", query, message: "Sessione scaduta. Accedi di nuovo.", payload: null };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return {
      status: "error",
      query,
      message: "Worker non configurato nell'ambiente web.",
      payload: null,
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
      body: JSON.stringify({ owner_id: ownerId, query }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | AssistantPayload
      | { detail?: string }
      | null;

    if (!response.ok || !payload || !("answer" in payload)) {
      return {
        status: "error",
        query,
        message: payload && "detail" in payload && payload.detail
          ? payload.detail
          : "La domanda non è stata elaborata.",
        payload: null,
      };
    }

    return {
      status: "success",
      query,
      message: payload.answer,
      payload,
    };
  } catch {
    return { status: "error", query, message: "Worker non raggiungibile.", payload: null };
  }
}
