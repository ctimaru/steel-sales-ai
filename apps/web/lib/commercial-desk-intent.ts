// COMM-DESK-AI2 — la chat riconosce le domande sulla propria scrivania e
// filtra la tabella sotto, invece di rispondere a parole.
// Riconoscimento deterministico, senza AI e senza leggere dati: produce solo
// un link ai filtri già esistenti e governati da RLS (view / focus).

export type CommercialDeskIntent = {
  /** Percorso con i filtri, senza ancora. */
  href: string;
  label: string;
  description: string;
};

const HOME = "/commercial";

// Deve nominare la propria lista: senza questo soggetto la domanda va all'assistente.
const subject = /(richiest[ae]|trattativ[ae]|\brfq\b|\brdo\b|offert[ae]|ordin[ei]|bozz[ae]|distint[ae]|attivit[aà]|scrivania|tabella|elenco)/iu;
const ask = /(mostra|fammi vedere|fai vedere|vedere|quali|quante|quanti|elenca|filtra|dammi|apri|cosa (devo|c['’]è|ho)|che cosa (devo|c['’]è|ho))/iu;
// Creazione, ricerca aziende e domande tecniche restano all'assistente.
const notDesk = /(prepara|preparami|crea|creami|aggiungi|nuova richiesta|nuova distinta|chi\s+(produce|fabbrica|vende|fornisce)|produttor[ei]|trova\s+(aziend|fornitor)|differenz[ae]|che cosa significa|cosa significa|spiega)/iu;

const filters: ReadonlyArray<{ test: RegExp; params: Record<string, string>; label: string; description: string }> = [
  { test: /(in scadenza|scad(e|ono|ranno|enza|enze|ut[ae])|urgent[ei])/iu, params: { focus: "due" },
    label: "In scadenza", description: "richieste dei clienti e RFQ ai fornitori ancora aperte che scadono entro 7 giorni" },
  { test: /(da rispondere|devo rispondere|senza risposta|da evadere|devo fare|da fare|c['’]è da fare)/iu, params: { focus: "reply" },
    label: "Da rispondere", description: "richieste e ordini dei clienti ancora aperti" },
  { test: /(in attesa|aspett)/iu, params: { focus: "waiting" },
    label: "In attesa", description: "offerte inviate, RFQ in raccolta e ordini emessi che aspettano una risposta" },
  { test: /(bozz[ae]|distint[ae])/iu, params: { view: "drafts" },
    label: "Bozze", description: "le distinte salvate" },
  { test: /offert[ae]/iu, params: { view: "offers" },
    label: "Offerte", description: "offerte commerciali e risposte dei fornitori" },
  { test: /ordin[ei]/iu, params: { view: "orders" },
    label: "Ordini", description: "ordini dei clienti e ordini di acquisto" },
  { test: /(ricevut[ae]|dai clienti|dei clienti)/iu, params: { view: "received" },
    label: "Ricevute", description: "le richieste ricevute dai clienti" },
  { test: /(inviat[ae]|ai fornitori|\brfq\b|\brdo\b)/iu, params: { view: "sent" },
    label: "Inviate", description: "le richieste inviate ai fornitori" },
  { test: /(tutt[eoi]|trattativ[ae]|attivit[aà]|richiest[ae])/iu, params: {},
    label: "Tutte", description: "tutte le trattative, senza filtri" },
];

export function commercialDeskIntent(input: string): CommercialDeskIntent | null {
  const value = input.normalize("NFKC").toLocaleLowerCase("it-IT").trim();
  if (!value || value.length > 160) return null;
  if (!subject.test(value) || !ask.test(value) || notDesk.test(value)) return null;
  // «Richieste di offerta» sono richieste, non offerte.
  const cleaned = value.replace(/richiest([ae]) d['’i]\s*offerta/giu, "richiest$1");
  const match = filters.find((filter) => filter.test.test(cleaned));
  if (!match) return null;
  return {
    // I filtri «focus» valgono sulla vista predefinita: senza ?view il menu
    // laterale resta su «Scrivania» invece di saltare a «Trattative».
    href: HOME + (Object.keys(match.params).length ? "?" + new URLSearchParams(match.params).toString() : ""),
    label: match.label,
    description: match.description,
  };
}
