"use server";

import { randomUUID } from "node:crypto";
import { requireWorkspaceWriteRole } from "@/lib/workspace-context";
import { buildRfqAiPrompt, parseRfqAiModelResponse, validateRfqAiText, type RfqAiTextDraftResult } from "@/lib/rfq-ai-free-text";

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
  const timeout = setTimeout(() => controller.abort(), 25_000);
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
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 3500,
        stream: false,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, error: response.status === 429
        ? "Servizio AI temporaneamente occupato. Riprova più tardi."
        : "Servizio AI non disponibile: la richiesta non è stata elaborata." };
    }
    const body = await response.json() as {
      choices?: { message?: { content?: string | null } }[];
    };
    const answer = body.choices?.[0]?.message?.content;
    if (!answer || answer.length > 48_000)
      return { ok: false, error: "Non è stato possibile interpretare la risposta AI." };
    const output = JSON.parse(answer) as unknown;
    // Derive ID on authenticated server; model cannot inject owner, tenant,
    // approvalState, sourceId, weights or save/dispatch decisions.
    const result = parseRfqAiModelResponse(text,
      { sourceId: "text:" + randomUUID(), channel: "free_text" }, output);
    return { ok: true, result };
  } catch {
    return { ok: false, error: "L'analisi AI non è riuscita. Nessuna riga è stata aggiunta." };
  } finally {
    clearTimeout(timeout);
  }
}
