"use server";

import { getOperationalEntityData, type OperationalEntityKind } from "@/lib/commercial-data";
import { createClient } from "@/lib/supabase/server";

export type DealEvidenceResult = { ok: true; facts: string[] } | { ok: false; message: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Called only after an explicit user gesture. Uses the current user's Supabase/RLS session. */
export async function loadAuthorizedDealEvidence(kind: string, id: string): Promise<DealEvidenceResult> {
  const allowed: Record<string, OperationalEntityKind> = {
    "inbound-rfq": "rfq", "inbound-offer": "offer", "inbound-order": "order",
  };
  const operationalKind = allowed[kind];
  if (!operationalKind || !uuid.test(id)) {
    return { ok: false, message: "Questa voce non supporta ancora la verifica per ID." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, message: "Sessione non verificata. Accedi per consultare le fonti." };
  const detail = await getOperationalEntityData(operationalKind, id);
  if (!detail || detail.mode !== "live") {
    return { ok: false, message: "Nessuna evidenza accessibile per questa trattativa. Non viene presunta alcuna offerta." };
  }
  const facts = [
    "Fonte: dettaglio operativo autorizzato (lettura per ID con RLS).",
    "Tipo: " + detail.kind,
    "Stato registrato: " + detail.status,
    "Articoli visibili: " + detail.lines.length,
    "Articoli mostrati nel riepilogo: " + Math.min(detail.lines.length, 3),
    "Tracciabilità: " + detail.lines.filter((line) => line.sourceObservationId !== null).length + " righe con riferimento a osservazione commerciale.",
    ...detail.lines.slice(0, 3).map((line) =>
      "Articolo: " + line.product.slice(0, 110) + " | " + line.quantity.slice(0, 45)),
  ];
  if (detail.lines.length > 3) facts.push("Altri articoli disponibili nel dettaglio originale; non inclusi in questo riepilogo.");
  return { ok: true, facts };
}
