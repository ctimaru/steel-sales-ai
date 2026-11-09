import type { RfqAiLineCandidate } from "@/lib/rfq-ai-intake-contract";

/**
 * Chat RFQ, passo 1: trasforma le segnalazioni dell'intake in domande mirate.
 * Funzione pura: nessuna chiamata AI, nessuna scrittura, nessun invio.
 *
 * Obbligatori per creare la bozza RFQ: norma, dimensioni, quantità e unità.
 * Consigliati ma non bloccanti: qualità del materiale e lunghezza barra.
 */
export type RfqChatQuestionKind = "blocking" | "advisory";
export type RfqChatQuestion = {
  line: number;
  kind: RfqChatQuestionKind;
  field: "standard" | "dimensions" | "quantity" | "unit" | "grade" | "barLength";
  text: string;
  example: string;
};

const BLOCKING: Record<string, { field: RfqChatQuestion["field"]; text: string; example: string }> = {
  missing_standard: { field: "standard", text: "manca la norma (EN 10219 o EN 10210)", example: "norma EN 10219" },
  unsupported_standard: { field: "standard", text: "la norma non è tra quelle gestite (EN 10219, EN 10210)", example: "norma EN 10219" },
  missing_dimensions: { field: "dimensions", text: "mancano le dimensioni della sezione", example: "spessore 5 mm" },
  invalid_geometry: { field: "dimensions", text: "le dimensioni non sono coerenti", example: "spessore 5 mm" },
  ambiguous_geometry: { field: "dimensions", text: "le dimensioni sono ambigue (tondo e quadro insieme)", example: "spessore 5 mm" },
  missing_quantity: { field: "quantity", text: "manca la quantità", example: "20 barre" },
  invalid_quantity: { field: "quantity", text: "la quantità non è valida (positiva, e intera se in barre)", example: "20 barre" },
  unsupported_quantity_unit: { field: "unit", text: "manca l'unità della quantità (barre, metri o tonnellate)", example: "20 barre" },
};

const ADVISORY: Record<string, { field: RfqChatQuestion["field"]; text: string; example: string }> = {
  missing_grade: { field: "grade", text: "manca la qualità del materiale (consigliata)", example: "qualità S355J2H" },
  missing_bar_length: { field: "barLength", text: "manca la lunghezza delle barre (consigliata)", example: "lunghezza 6 m" },
  invalid_bar_length: { field: "barLength", text: "la lunghezza delle barre non è valida", example: "lunghezza 6 m" },
};

export function buildRfqChatQuestions(candidates: readonly RfqAiLineCandidate[]): {
  questions: RfqChatQuestion[];
  blockingCount: number;
  canCreateDraft: boolean;
} {
  const questions: RfqChatQuestion[] = [];
  candidates.forEach((candidate, index) => {
    const seen = new Set<string>();
    for (const issue of candidate.issues) {
      const rule = BLOCKING[issue.code] ?? ADVISORY[issue.code];
      if (!rule) continue;
      const kind: RfqChatQuestionKind = BLOCKING[issue.code] ? "blocking" : "advisory";
      const key = kind + ":" + rule.field;
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push({ line: index + 1, kind, field: rule.field, text: rule.text, example: rule.example });
    }
  });
  const blockingCount = questions.filter((q) => q.kind === "blocking").length;
  return { questions, blockingCount, canCreateDraft: candidates.length > 0 && blockingCount === 0 };
}

/** Testo del turno dell'assistente: cosa manca, riga per riga, e come rispondere. */
export function describeRfqChatQuestions(candidates: readonly RfqAiLineCandidate[]): string | null {
  const { questions, blockingCount } = buildRfqChatQuestions(candidates);
  if (!questions.length) return null;
  const lines: string[] = [];
  const byLine = new Map<number, RfqChatQuestion[]>();
  for (const q of questions) byLine.set(q.line, [...(byLine.get(q.line) ?? []), q]);
  for (const [line, items] of byLine) {
    lines.push("Riga " + line + ": " + items.map((q) => q.text).join("; ") + ".");
  }
  const first = questions.find((q) => q.kind === "blocking") ?? questions[0];
  return (
    (blockingCount
      ? "Per preparare la bozza RFQ mi servono ancora alcuni dati."
      : "I dati essenziali ci sono; ti suggerisco di completare questi dettagli.") +
    " " + lines.join(" ") +
    " Rispondi ad esempio “riga " + first.line + ": " + first.example + "”."
  );
}
