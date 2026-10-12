"use server";

import { randomUUID } from "node:crypto";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";
import { buildRfqAiPrompt, parseRfqAiModelResponse, validateRfqAiText, type RfqAiTextDraftResult } from "@/lib/rfq-ai-free-text";
import {
  RFQAI3_RESPONSE_FORMAT,
  RfqAiGatewayOutputError,
  readRfqAiGatewayOutput,
  rfqAiGatewayHttpFailure,
  rfqAiGatewayOutputFailure,
} from "@/lib/rfq-ai-gateway-protocol";

/** No tenant, user or ownership input is accepted from the browser. */
export type RfqAiTextActionResult =
  | { ok: true; result: RfqAiTextDraftResult }
  | { ok: false; error: string };

/**
 * Best-effort per-instance abuse brake; NOT a distributed quota.
 * Keep Gateway project budgets/rate limits enabled before broad rollout.
 */
const recent = new Map<string, { count: number; until: number }>();
function acquireBurstSlot(key: string): boolean {
  const now = Date.now();
  if (recent.size > 2000) for (const [id, v] of recent) if (v.until < now) recent.delete(id);
  const current = recent.get(key);
  if (current && current.until > now) {
    if (current.count >= 3) return false;
    current.count += 1;
    return true;
  }
  recent.set(key, { count: 1, until: now + 60_000 });
  return true;
}

/** Call AI Gateway (not a browser-callable endpoint). No model output persists. */
export async function analyzeRfqAiFreeText(input: string): Promise<RfqAiTextActionResult> {
  // The existing requireWorkspaceWriteRole performs real Supabase user, active
  // membership, legal acceptance and organization role checks on every call.
  const context = await requireWorkspaceWriteRole("/rfq-hub");
  let text: string;
  try {
    text = validateRfqAiText(input);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Richiesta non valida." };
  }
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!token || process.env.RFQAI3_ENABLED === "false") {
    return { ok: false, error: "L’estrazione AI non è ancora configurata. La distinta manuale rimane disponibile." };
  }
  if (!acquireBurstSlot(context.organizationId + ":" + context.userId))
    return { ok: false, error: "Limite temporaneo raggiunto: riprova più tardi." };

  const model = process.env.RFQAI3_MODEL || "alibaba/qwen-3-14b";
  const controller = new AbortController();
  // Qwen3 can spend tokens in its default thinking mode; explicitly disable
  // reasoning for deterministic, latency-sensitive extraction, with a longer
  // upper bound for occasional provider delays.
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const traceId = randomUUID().slice(0, 8);
  let phase: "gateway_fetch" | "gateway_body" | "model_response" | "candidate_validation" = "gateway_fetch";
  const diagnostic = (kind: string, httpStatus?: number) => {
    // No input text, model output, user IDs or credentials may enter logs.
    console.warn("[RFQAI3] AI Gateway extraction failed", {
      traceId, phase, kind, ...(httpStatus ? { httpStatus } : {}),
    });
  };
  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: buildRfqAiPrompt(text),
        response_format: RFQAI3_RESPONSE_FORMAT,
        reasoning: { effort: "none" },
        temperature: 0.2,
        max_tokens: 5000,
        stream: false,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const failure = rfqAiGatewayHttpFailure(response.status);
      diagnostic(failure.kind, response.status);
      return { ok: false, error: failure.message };
    }
    phase = "gateway_body";
    const body = await response.json() as unknown;
    phase = "model_response";
    const output = readRfqAiGatewayOutput(body);
    phase = "candidate_validation";
    // Derive ID on authenticated server; model cannot inject owner, tenant,
    // approvalState, sourceId, weights or save/dispatch decisions.
    const result = parseRfqAiModelResponse(text,
      { sourceId: "text:" + randomUUID(), channel: "free_text" }, output);
    return { ok: true, result };
  } catch (error) {
    if (controller.signal.aborted) {
      diagnostic("timeout");
      return { ok: false, error: "Il modello AI non ha risposto entro 45 secondi. Riprova con una richiesta più breve." };
    }
    if (error instanceof RfqAiGatewayOutputError) {
      diagnostic(error.kind);
      return { ok: false, error: rfqAiGatewayOutputFailure(error.kind) };
    }
    if (phase === "candidate_validation") {
      diagnostic("invalid_candidates");
      return { ok: false, error: "L'AI ha restituito articoli non validi. Nessuna riga è stata importata." };
    }
    if (phase === "gateway_body") {
      diagnostic("invalid_upstream_envelope");
      return { ok: false, error: "AI Gateway ha restituito una risposta tecnica non valida. Riprova più tardi." };
    }
    // No raw provider response or exception message is disclosed to the client.
    diagnostic("network_or_gateway_failure");
    return { ok: false, error: "Collegamento con AI Gateway non riuscito. Verifica la disponibilità del servizio." };
  } finally {
    clearTimeout(timeout);
  }
}
