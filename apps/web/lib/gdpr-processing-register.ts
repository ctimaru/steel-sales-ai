export type ProcessingActivity = {
  id: string;
  title: string;
  role: "controller" | "processor_context" | "governance_gate";
  status: "active" | "open";
  notice: "art13" | "art14" | "customer_dpa";
  purpose: string;
  legalBasis: string;
  data: string;
  sources: string;
  recipients: string;
  retention: string;
  transfers: string;
};

export const GDPR_REGISTER_VERSION = "LR3-2026-10-04-v1";

export const GDPR_PROCESSING_ACTIVITIES: ProcessingActivity[] = [
  {
    id: "account-auth",
    title: "Account, login e accessi",
    role: "controller",
    status: "active",
    notice: "art13",
    purpose: "Creare e proteggere account, autenticare l'utente e applicare ruoli.",
    legalBasis: "Art. 6(1)(b) GDPR; Art. 6(1)(f) per sicurezza strettamente necessaria.",
    data: "email account; identificativi tecnici; verifica email; ruoli; sessione/autenticazione.",
    sources: "interessato; provider di autenticazione.",
    recipients: "Supabase Auth; personale autorizzato.",
    retention: "Durata account; post-chiusura e backup da finalizzare in LR5/LR7.",
    transfers: "Da verificare nel registro fornitori LR6.",
  },
  {
    id: "company-registration",
    title: "Registrazione azienda e review",
    role: "controller",
    status: "active",
    notice: "art13",
    purpose: "Ricevere, verificare e decidere richieste di attivazione.",
    legalBasis: "Art. 6(1)(b) GDPR; Art. 6(1)(f) per duplicati, abusi e integrità della review.",
    data: "email richiedente; nome referente; telefono facoltativo; dati societari; sito; descrizione; audit review.",
    sources: "interessato; account autenticato.",
    recipients: "personale autorizzato; Supabase; provider email quando necessario.",
    retention: "Nessuna cancellazione automatica completa oggi: periodi da rendere operativi in LR5/LR7.",
    transfers: "Da consolidare in LR6.",
  },
  {
    id: "company-claim",
    title: "Claim e verifica ruolo aziendale",
    role: "controller",
    status: "active",
    notice: "art13",
    purpose: "Verificare la legittimità del claim e prevenire appropriazioni indebite.",
    legalBasis: "Art. 6(1)(b) GDPR; Art. 6(1)(f) per sicurezza e antifrode.",
    data: "identità account; contatti; azienda; evidenze fornite; stato e audit verifica.",
    sources: "interessato; profilo selezionato; evidenze fornite.",
    recipients: "personale autorizzato; Supabase.",
    retention: "Durante verifica; post-decisione ed evidenze da finalizzare in LR4/LR7.",
    transfers: "Da consolidare in LR6.",
  },
  {
    id: "public-company-directory",
    title: "Directory pubblica da fonti pubbliche",
    role: "governance_gate",
    status: "open",
    notice: "art14",
    purpose: "Creare profili aziendali minimi e supportare discovery/claim.",
    legalBasis: "OPEN LR4 per eventuali dati riferibili a persone fisiche; company-only data resta separato.",
    data: "ragione sociale; sito; sede; prodotti; capacità; certificazioni; provenance; eventuali dati professionali soggetti a gate.",
    sources: "siti aziendali e fonti pubbliche governate.",
    recipients: "visitatori per soli campi approvati; personale autorizzato.",
    retention: "Dati societari finché accurati; dati personali non attivabili senza LR4.",
    transfers: "Da consolidare in LR4/LR6.",
  },
  {
    id: "public-analytics",
    title: "Analytics superfici pubbliche",
    role: "controller",
    status: "active",
    notice: "art13",
    purpose: "Misurare traffico e performance delle superfici pubbliche.",
    legalBasis: "Art. 6(1)(a) GDPR — consenso.",
    data: "cookie/identificatori analytics dopo consenso; pagina; sorgente traffico; dati tecnici provider.",
    sources: "browser; Google Analytics 4.",
    recipients: "Google Analytics; personale autorizzato.",
    retention: "Preferenza locale 6 mesi; retention GA4 da verificare/configurare in LR6.",
    transfers: "Da documentare in LR6.",
  },
  {
    id: "security-audit",
    title: "Sicurezza, audit e prevenzione abusi",
    role: "controller",
    status: "active",
    notice: "art13",
    purpose: "Proteggere account, dati e workflow e ricostruire operazioni rilevanti.",
    legalBasis: "Art. 6(1)(f) GDPR — interesse legittimo alla sicurezza; LIA da formalizzare in LR7.",
    data: "identificativo attore; timestamp; azione; stato workflow; metadati tecnici necessari.",
    sources: "uso del servizio; sistemi applicativi.",
    recipients: "personale autorizzato; provider infrastrutturali pertinenti.",
    retention: "OPEN LR7: separare log sicurezza, audit amministrativo e log applicativo.",
    transfers: "Da consolidare in LR6.",
  },
  {
    id: "transactional-email",
    title: "Email transazionali e di servizio",
    role: "controller",
    status: "active",
    notice: "art13",
    purpose: "Inviare verifica, inviti, esiti e comunicazioni necessarie al servizio.",
    legalBasis: "Art. 6(1)(b) GDPR; Art. 6(1)(f) per notifiche di sicurezza quando applicabile.",
    data: "email; nome quando necessario; tipo/stato comunicazione; log tecnico di consegna.",
    sources: "account; workflow applicativa.",
    recipients: "provider email/SMTP; personale autorizzato quando necessario.",
    retention: "Da definire con provider e necessità audit in LR6/LR7.",
    transfers: "Da consolidare in LR6.",
  },
  {
    id: "commercial-memory",
    title: "Commercial Memory privata",
    role: "processor_context",
    status: "open",
    notice: "customer_dpa",
    purpose: "Organizzare contatti, email, RFQ, offerte, ordini e documenti caricati dal tenant.",
    legalBasis: "Nel modello B2B previsto il tenant determina finalità/base; Smart Steel Sales opera normalmente per suo conto ai sensi dell'Art. 28, salvo trattamenti propri distinti.",
    data: "contatti professionali; email e allegati; RFQ; offerte; prezzi; ordini; documenti commerciali.",
    sources: "azienda tenant; import email/documenti.",
    recipients: "tenant; Smart Steel Sales; subprocessors autorizzati nel DPA.",
    retention: "Da definire contrattualmente in LR5/LR6/LR7; nessuna pubblicazione nel Network.",
    transfers: "Da definire nel DPA e nel registro LR6.",
  },
];
