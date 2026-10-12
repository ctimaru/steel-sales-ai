"use server";

import { createClient } from "@/lib/supabase/server";

export type P1AssistantEvidence = {
  citation_id: string;
  chunk_id?: string;
  source_id?: string;
  document_id?: string;
  content: string;
  title?: string | null;
  filename?: string | null;
  document_type?: string | null;
  source_name?: string | null;
  source_class?: string | null;
  source_uri?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  section_path?: string[] | null;
  source_locator?: Record<string, unknown> | null;
};

export type P1AssistantObservation = {
  id?: number;
  thread_id?: string | null;
  item_role?: string | null;
  grade?: string | null;
  standard?: string | null;
  outer_diameter_mm?: number | string | null;
  width_mm?: number | string | null;
  height_mm?: number | string | null;
  thickness_mm?: number | string | null;
  length_mm?: number | string | null;
  quantity?: number | string | null;
  quantity_unit?: string | null;
  price_value?: number | string | null;
  price_unit?: string | null;
  currency?: string | null;
  source_text?: string | null;
  source_filename?: string | null;
  commercial_at?: string | null;
  offered_at?: string | null;
  thread_subject?: string | null;
};

export type P1AssistantPayload = {
  intent: string;
  found: boolean;
  answer: string;
  filters?: Record<string, unknown>;
  context?: Record<string, unknown> | null;
  observations?: P1AssistantObservation[];
  evidence?: P1AssistantEvidence[];
  grounding?: {
    mode?: string;
    status?: string;
    generator?: string | null;
    model?: string | null;
    evidence_count?: number;
    citations?: string[];
  } | null;
  access?: { membership_verified?: boolean; role?: string | null } | null;
};

export type P1AssistantTurn = {
  query: string;
  status: "success" | "error";
  message: string;
  payload?: P1AssistantPayload | null;
};

export type P1AssistantState = {
  status: "idle" | "success" | "error";
  message: string;
  context?: Record<string, unknown> | null;
  turns: P1AssistantTurn[];
};

function appendTurn(state: P1AssistantState, turn: P1AssistantTurn) {
  return [...state.turns, turn].slice(-10);
}

export async function askP1Assistant(
  previousState: P1AssistantState,
  formData: FormData,
): Promise<P1AssistantState> {
  const raw = formData.get("query");
  const query = typeof raw === "string" ? raw.trim() : "";
  if (query.length < 2) {
    const message = "Scrivi una domanda commerciale.";
    return {
      ...previousState,
      status: "error",
      message,
      turns: appendTurn(previousState, { query, status: "error", message }),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const actorUserId = !error && data.user?.id ? data.user.id : null;
  if (!actorUserId) {
    const message = "Sessione non valida o scaduta. Accedi di nuovo.";
    return {
      ...previousState,
      status: "error",
      message,
      turns: appendTurn(previousState, { query, status: "error", message }),
    };
  }

  const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    const message = "Worker non configurato nell'ambiente web.";
    return {
      ...previousState,
      status: "error",
      message,
      turns: appendTurn(previousState, { query, status: "error", message }),
    };
  }

  const headers: HeadersInit = { "content-type": "application/json" };
  if (process.env.WORKER_INTERNAL_TOKEN) headers["x-worker-token"] = process.env.WORKER_INTERNAL_TOKEN;

  try {
    const response = await fetch(`${workerUrl}/v1/assistant`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        actor_user_id: actorUserId,
        query,
        context: previousState.context ?? undefined,
      }),
      cache: "no-store",
    });
    const rawPayload = (await response.json().catch(() => null)) as P1AssistantPayload | { detail?: string } | null;
    if (!response.ok || !rawPayload || !("answer" in rawPayload)) {
      const message = rawPayload && "detail" in rawPayload && rawPayload.detail
        ? rawPayload.detail
        : "La domanda non è stata elaborata.";
      return {
        ...previousState,
        status: "error",
        message,
        turns: appendTurn(previousState, { query, status: "error", message }),
      };
    }

    const payload: P1AssistantPayload = {
      ...rawPayload,
      evidence: (rawPayload.evidence ?? []).slice(0, 8),
      observations: (rawPayload.observations ?? []).slice(0, 12),
    };
    const turn: P1AssistantTurn = { query, status: "success", message: payload.answer, payload };
    return {
      status: "success",
      message: payload.answer,
      context: payload.context ?? previousState.context ?? null,
      turns: appendTurn(previousState, turn),
    };
  } catch {
    const message = "Worker AI Assistant non raggiungibile.";
    return {
      ...previousState,
      status: "error",
      message,
      turns: appendTurn(previousState, { query, status: "error", message }),
    };
  }
}
