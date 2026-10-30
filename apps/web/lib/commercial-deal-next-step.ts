import type { UnifiedCommercialKind } from "@/lib/commercial-unified-data";

export type CommercialDealNextStep = {
  title: string;
  description: string;
  actionLabel: string;
};

/**
 * Display guidance, never authorization. RFQ dispatch, awards and orders remain
 * governed by their original server actions and owner/workspace policies.
 */
export function commercialDealNextStep(
  kind: UnifiedCommercialKind,
  status: string,
  canWrite: boolean,
): CommercialDealNextStep {
  if (!canWrite) {
    return {
      title: "Consulta i dati della trattativa",
      description: "Puoi esaminare materiali, condizioni e fonti autorizzate. Le azioni commerciali restano in sola lettura.",
      actionLabel: "Apri dettaglio →",
    };
  }
  if (kind === "distinta") return {
    title: "Riapri la Distinta e scegli i fornitori",
    description: "Controlla articoli e quantità prima di predisporre un'eventuale RFQ. Non viene inviato nulla automaticamente.",
    actionLabel: "Apri distinta →",
  };
  if (kind === "campaign") {
    if (status === "draft") return {
      title: "Completa la RFQ e verifica i fornitori",
      description: "La richiesta è una bozza: controlla distinta e destinatari prima del lancio.",
      actionLabel: "Apri RFQ →",
    };
    if (status === "ready") return {
      title: "Verifica la RFQ prima dell'invio",
      description: "Destinatari e condizioni vanno confermati nella RFQ originale; nessun invio da questa scheda.",
      actionLabel: "Apri RFQ →",
    };
    if (status === "launched" || status === "collecting") return {
      title: "Verifica le risposte dei fornitori",
      description: "Apri la RFQ per confrontare le offerte disponibili e le condizioni autorizzate.",
      actionLabel: "Vedi risposte →",
    };
    if (status === "awarded") return {
      title: "Controlla aggiudicazione e ordini",
      description: "Apri la RFQ per verificare i documenti e gli stati effettivi degli ordini.",
      actionLabel: "Verifica ordini →",
    };
    return {
      title: "Controlla lo stato della RFQ",
      description: "Verifica eventuali decisioni e documenti nel flusso originale.",
      actionLabel: "Apri RFQ →",
    };
  }
  if (kind === "quote") return {
    title: "Confronta l'offerta ricevuta",
    description: "Verifica copertura materiale, prezzi e condizioni nel confronto RFQ autorizzato.",
    actionLabel: "Confronta offerte →",
  };
  if (kind === "purchase-order") return {
    title: "Verifica ordine e conferma fornitore",
    description: "Controlla l'ordine, le condizioni e gli eventuali documenti nel flusso PO originale.",
    actionLabel: "Verifica ordine →",
  };
  return {
    title: "Verifica fonte e condizioni commerciali",
    description: "Apri il record originale per controllare articoli, quantità e documenti disponibili.",
    actionLabel: "Apri dettaglio →",
  };
}
