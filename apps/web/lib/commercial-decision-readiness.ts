import type { UnifiedCommercialKind } from "@/lib/commercial-unified-data";
import type { CommercialDealFacts } from "@/components/commercial-deal-intelligence";

export type DecisionCheck = {
  label: string;
  category: "missing" | "verify";
};
/** Advisory ONLY. No score, approval flag or business-rule bypass. */
export type DecisionReadiness = {
  available: boolean;
  checks: DecisionCheck[];
  notice: string;
};

const unresolved = (text: string) =>
  /^(?:da associare|da selezionare|da verificare|verifica i destinatari)/i.test(text.trim());

/**
 * Distinguish a field genuinely not exposed in the selected authorized record
 * from a commercial condition that still needs checking at its original source.
 * Never infer recipients, credit, amounts, attachment existence or approval.
 */
export function commercialDecisionReadiness(
  kind: UnifiedCommercialKind,
  facts: CommercialDealFacts | null,
  canWrite: boolean,
): DecisionReadiness {
  if (!facts) return {
    available: false,
    checks: [],
    notice: "Non è possibile valutare la completezza: il dettaglio autorizzato non è disponibile.",
  };
  const checks: DecisionCheck[] = [];
  const add = (category: DecisionCheck["category"], label: string) =>
    checks.push({ category, label });

  if (kind.startsWith("inbound-") && unresolved(facts.counterparty)) {
    add("missing", "Controparte non associata al record commerciale.");
  } else if (kind === "distinta") {
    add("verify", "Seleziona e verifica i fornitori nell'eventuale RFQ.");
  } else if (kind === "campaign") {
    add("verify", "Conferma i destinatari nella RFQ originale: qui non sono attestati.");
  } else if ((kind === "quote" || kind === "purchase-order") && unresolved(facts.counterparty)) {
    add("verify", "Verifica l'identità del fornitore nel documento originale.");
  }
  if (facts.materials.length === 0) {
    add("missing", "Articoli non disponibili in questa scheda; verifica la fonte.");
  } else if (facts.materials.some(line =>
    !line.quantity || line.quantity === "Quantità non disponibile")) {
    add("missing", "Quantità di alcuni articoli non visibile in questa scheda.");
  }
  if (!facts.quantity && !kind.startsWith("inbound-") && facts.materials.length > 0) {
    add("verify", "Totale metri/tonnellate non riportato qui: verifica la Distinta.");
  }
  if (kind === "campaign") {
    if (facts.rawStatus === "draft" || facts.rawStatus === "ready") {
      add("verify", "Controlla scadenze e condizioni prima di un eventuale invio.");
    } else {
      add("verify", "Verifica risposte e scadenze nello stato reale della RFQ.");
    }
  } else if (kind === "quote") {
    add("verify", "Confronta copertura, prezzi offerti, validità e consegna nella RFQ.");
  } else if (kind === "purchase-order") {
    if (!facts.price) {
      add("missing", "Totale dell'ordine non disponibile in questa scheda.");
    }
    add("verify", "Controlla termini di pagamento, consegna e conferma nel PO.");
  } else if (kind === "distinta") {
    add("verify", "I target per articolo non sono offerte né prezzi confermati.");
  } else if (kind === "inbound-rfq") {
    add("verify", "Verifica specifiche, quantità e termini richiesti nel record cliente.");
  } else if (kind.startsWith("inbound-")) {
    add("verify", "Controlla prezzi e condizioni nel documento commerciale originale.");
  }
  if (!facts.sources.length) {
    add("verify", "Nessun collegamento alla fonte è disponibile in questa scheda.");
  }
  return {
    available: true,
    checks: checks.slice(0, 4),
    notice: canWrite ?
      "Controlli suggeriti, non una validazione automatica. Conferma e invio restano nel flusso originale." :
      "Consultazione in sola lettura: questi controlli non autorizzano alcuna operazione.",
  };
}
