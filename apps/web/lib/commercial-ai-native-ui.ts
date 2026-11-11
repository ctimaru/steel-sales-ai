/**
 * COMM-AI-NATIVE1.B: safe, deterministic UI hints while the authenticated
 * intent router and industrial retrieval are developed in C/D.
 * This classifier never queries or mutates company, Distinta or RFQ data.
 */
export type CommercialAiNativeTopic = "network" | "distinta" | "knowledge" | "general";

export function classifyCommercialAiNativeTopic(input: string): CommercialAiNativeTopic {
  const value = input.normalize("NFKC").toLocaleLowerCase("it-IT").trim();
  if (!value) return "general";
  // Supplier/product-facility questions must NEVER be sent to the Distinta extractor.
  if (/(chi\s+(produce|fabbrica|vende|fornisce)|quali?\s+(aziend[ea]|produttor[ei]|fornitor[ei])|produttor[ei]|fornitor[ei]|rivenditor[ei]|commerciant[ei]|stockist|stockholder|carpenteri[ea]|trova\s+(aziend[ea]|fornitor[ei]|produttor[ei]))/iu.test(value)) {
    return "network";
  }
  if (/(differenz[ae]|che cosa (significa|indica)|cosa (significa|indica)|spiega|cos['’]è|come si calcola|quale norma|cosa prevede|certificat[oi]|dichiarazione di prestazione)/iu.test(value)) {
    return "knowledge";
  }
  if (/(distint[ae]|richiest[ae] di offerta|\brfq\b|preventiv[oi]|preparami|crea|aggiungi|correggi|riga\s*\d+|\bbarre?\b|\btonnellat[ae]\b|\btub[oi]\b|\bprofil[oi]\b)/iu.test(value)) {
    return "distinta";
  }
  return "general";
}
