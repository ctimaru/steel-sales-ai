/**
 * COMM-AI-NATIVE1.C: pure, read-only intent boundary.
 * Classification does not create a Distinta, RFQ, dispatch or Network assertion.
 * Deterministic precedence keeps supplier questions out of item extraction.
 */
export type CommercialAiIntent =
  | "industry_search"
  | "technical_question"
  | "distinta_edit"
  | "rfq_prepare"
  | "unknown";

export type CommercialAiNativeEntities = {
  standard: string | null;
  grade: string | null;
  diameterMm: number | null;
  thicknessMm: number | null;
};

export type CommercialAiIntentResult = {
  intent: CommercialAiIntent;
  entities: CommercialAiNativeEntities;
  missing: string[];
};

export function routeCommercialAiIntent(input: string): CommercialAiIntentResult {
  const value = input.normalize("NFKC").toLocaleLowerCase("it-IT").trim();
  const standard = value.match(/\b(?:en\s*10219|en\s*10210|astm\s*a500)\b/i)?.[0]
    .replace(/\s+/g, " ").toUpperCase() ?? null;
  const grade = value.match(/\bs(?:235|275|355|420|460)(?:jrh|j0h|j2h|k2h|nh|nlh|mh|mlh|h)?\b/i)?.[0].toUpperCase() ?? null;
  const diameter = value.match(/(?:[ø⌀]|diametr[oa]|diameter|\bd\.)\s*(\d{2,4}(?:[.,]\d{1,2})?)/iu);
  const diameterMm = diameter ? Number(diameter[1].replace(",", ".")) : null;
  const thickness = value.match(/(?:spessor[ei]|thickness|\bt\.)\s*(\d{1,2}(?:[.,]\d{1,2})?)/iu)
    ?? (diameter ? value.slice(diameter.index! + diameter[0].length).match(/^\s*[x×]\s*(\d{1,2}(?:[.,]\d{1,2})?)/) : null);
  const thicknessMm = thickness ? Number(thickness[1].replace(",", ".")) : null;

  const entities = { standard, grade, diameterMm, thicknessMm };
  const isSearch = /(chi\s+(produce|fabbrica|vende|fornisce)|quali?\s+(aziend[ea]|produttor[ei]|fornitor[ei])|trova\s+(aziend[ea]|fornitor[ei]|produttor[ei]|carpenteri[ea])|cerca\s+(aziend[ea]|fornitor[ei]|produttor[ei]|carpenteri[ea])|produttor[ei]|fornitor[ei]|rivenditor[ei]|commerciant[ei]|stockist|stockholder|carpenteri[ea]|who\s+(makes|produces|supplies)|find\s+(suppliers|manufacturers))/iu.test(value);
  const isRfq = /(?:\brfq\b|richiest[ae]\s+di\s+offerta|request\s+for\s+quotation|invia\s+la\s+richiesta|manda\s+ai\s+fornitori|spedisc[ei]\s+ai\s+fornitori)/iu.test(value);
  const isTechnical = /(differenz[ae]|che cosa (significa|indica)|cosa (significa|indica)|spiega|cos['’]?è|come si calcola|quale norma|cosa prevede|certificat[oi]|dichiarazione di prestazione|compare\s+en\s+|what\s+is\s+the\s+difference|explain\s+|meaning\s+of)/iu.test(value);
  const isDistinta = /(distint[ae]|preparami|crea|aggiungi|correggi|modifica\s+la\s+riga|riga\s*\d+|\bbarre?\b|\btonnellat[ae]\b|creat[ei]\s+(?:a\s+)?(?:bill|list)|add\s+\d+)/iu.test(value);
  let intent: CommercialAiIntent = "unknown";
  // A supplier lookup with an RFQ request is preparation, never auto-dispatch.
  if (isRfq) intent = "rfq_prepare";
  else if (isSearch) intent = "industry_search";
  else if (isTechnical) intent = "technical_question";
  else if (isDistinta) intent = "distinta_edit";
  const missing: string[] = [];
  // Ask for tube details only when a diameter is explicitly mentioned.
  if (intent === "industry_search" && diameterMm !== null) {
    if (!standard) missing.push("norma");
    if (thicknessMm === null) missing.push("spessore");
  }
  return { intent, entities, missing };
}
