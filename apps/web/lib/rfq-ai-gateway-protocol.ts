/**
 * RFQAI3 gateway protocol: strict machine-readable JSON, with no model
 * permission to invent ownership, published weights or approval decisions.
 * Keep this pure to test malformed upstream responses without live credentials.
 */
export const RFQAI3_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "rfqai3_tube_candidates",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        intent: { type: "string", enum: ["buyer_request", "supplier_quote", "unknown"] },
        lines: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              sourceText: { type: "string" },
              itemRole: { type: "string" },
              standard: { type: "string" },
              grade: { type: "string" },
              outerDiameterMm: { type: "string" },
              widthMm: { type: "string" },
              heightMm: { type: "string" },
              thicknessMm: { type: "string" },
              lengthMm: { type: "string" },
              quantity: { type: "string" },
              quantityUnit: { type: "string" },
              finish: { type: "string" },
              note: { type: "string" },
            },
            required: [
              "sourceText", "itemRole", "standard", "grade",
              "outerDiameterMm", "widthMm", "heightMm", "thicknessMm",
              "lengthMm", "quantity", "quantityUnit", "finish", "note",
            ],
          },
        },
      },
      required: ["intent", "lines"],
    },
  },
} as const;

export type RfqAiGatewayMessage = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null };
  }>;
};

export class RfqAiGatewayOutputError extends Error {
  constructor(
    public readonly kind: "empty" | "truncated" | "invalid_json" | "invalid_envelope",
  ) { super(kind); }
}

export function readRfqAiGatewayOutput(value: unknown): unknown {
  if (!value || typeof value !== "object") throw new RfqAiGatewayOutputError("invalid_envelope");
  const root = value as RfqAiGatewayMessage;
  const choice = root.choices?.[0];
  if (choice?.finish_reason === "length") throw new RfqAiGatewayOutputError("truncated");
  const content = choice?.message?.content;
  if (!content || typeof content !== "string" || content.length > 48_000)
    throw new RfqAiGatewayOutputError("empty");

  try {
    // Some providers emit fenced JSON despite strict instructions. Remove
    // fencing only when it surrounds the entire output, never eval source text.
    const value = content.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new RfqAiGatewayOutputError("invalid_envelope");
    return parsed;
  } catch (error) {
    if (error instanceof RfqAiGatewayOutputError) throw error;
    throw new RfqAiGatewayOutputError("invalid_json");
  }
}

export function rfqAiGatewayHttpFailure(status: number): { kind: string; message: string } {
  if (status === 401 || status === 403)
    return { kind: "credential", message: "AI Gateway ha rifiutato l'autenticazione. Verifica la chiave API e i permessi del progetto Vercel." };
  if (status === 402)
    return { kind: "budget", message: "Credito o budget AI Gateway insufficiente. Verifica fatturazione e limite di spesa." };
  if (status === 404)
    return { kind: "model", message: "Il modello AI configurato non è disponibile. Controlla RFQAI3_MODEL." };
  if (status === 429)
    return { kind: "rate_limit", message: "Servizio AI temporaneamente occupato: attendi e riprova." };
  if (status === 408 || status === 504)
    return { kind: "timeout", message: "Il servizio AI ha impiegato troppo tempo. Riprova con una richiesta più breve." };
  if (status === 400 || status === 422)
    return { kind: "request", message: "Il modello AI ha rifiutato il formato richiesto. Controlla la compatibilità della configurazione AI Gateway." };
  if (status >= 500)
    return { kind: "upstream", message: "Il fornitore del modello AI è temporaneamente indisponibile. La distinta non è stata modificata." };
  return { kind: "gateway", message: "Il servizio AI non ha accettato la richiesta. Nessun articolo è stato aggiunto." };
}

export function rfqAiGatewayOutputFailure(kind: RfqAiGatewayOutputError["kind"]): string {
  if (kind === "truncated") return "L'AI non ha completato la risposta. Prova a ridurre il numero di articoli.";
  if (kind === "empty") return "Il modello AI ha restituito una risposta vuota. Nessun articolo è stato importato.";
  return "La risposta AI non è in un formato valido. Nessun articolo è stato importato.";
}
