/**
 * PROD-NEXT1.E3 — public code may describe requirements, NEVER attest that
 * a real backup, legal review, JWT matrix or production pilot was approved.
 * Evidence exists outside the application and requires independent review.
 * No action here changes a Supabase release flag or permits customer tracking.
 */
export const PILOT_E3_LIVE_AUTHORIZED = false as const;
export const PILOT_E3_RECOVERY_EVIDENCE = [
  {
    id: "database",
    label: "Database",
    detail: "Esportazione cifrata, conservazione indipendente e restore verificato con integrità e RPO/RTO.",
    proof: "Backup reale + verbale di ripristino separato",
  },
  {
    id: "storage",
    label: "Storage",
    detail: "Inventario bucket e ripristino dei byte reali, oltre ai metadati PostgreSQL.",
    proof: "Manifest e checksum + recupero oggetti",
  },
  {
    id: "migration",
    label: "Migration ledger",
    detail: "Conciliazione globale versione/nome/SQL; nessun push o repair automatico.",
    proof: "SUPA-LEDGER1 #780 chiuso con evidenza",
  },
  {
    id: "security",
    label: "JWT e tenant",
    detail: "Accessi buyer/supplier/Superadmin e isolamento prezzi in staging con JWT reali di test.",
    proof: "Matrice firmata e regression acceptance",
  },
  {
    id: "legal",
    label: "Legale e privacy",
    detail: "Identità, informativa, termini, DPA e basi giuridiche per finalità approvate.",
    proof: "Versioni e approvazione legale indipendente",
  },
  {
    id: "operations",
    label: "Supporto e GO",
    detail: "Incident response, contatti, rollback, cohort autorizzato e decisione datata del Founder.",
    proof: "Runbook, responsabili e sign-off esplicito",
  },
] as const;

/** CI fixture success does not fulfill any of these production evidence requirements. */
export function pilotE3MissingEvidence() {
  return PILOT_E3_RECOVERY_EVIDENCE.map(({ id }) => id);
}
