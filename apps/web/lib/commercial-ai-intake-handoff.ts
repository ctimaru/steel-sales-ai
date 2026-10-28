"use client";

const HANDOFF_KEY = "sss:commercial-ai-intake-handoff";

/** One-time local transfer into the authenticated RFQ editor.
 * Does not infer geometry, persist a draft on the server, or trigger AI execution.
 */
export function consumeCommercialAiTextHandoff(maxChars: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    const draft = window.sessionStorage.getItem(HANDOFF_KEY);
    if (draft === null) return null;
    window.sessionStorage.removeItem(HANDOFF_KEY);
    const value = draft.trim();
    return value ? value.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}
