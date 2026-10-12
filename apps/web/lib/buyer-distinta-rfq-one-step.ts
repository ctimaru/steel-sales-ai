/**
 * BD12 — one click, two existing guarded server actions.
 * An immutable saved snapshot is retained on creation failure, so retries
 * never save a second copy after a successfully acknowledged snapshot.
 * Never dispatches supplier messages or publishes to the Marketplace.
 */
export type SaveSnapshotResult = { ok: boolean; distintaId?: string; error?: string };
export type CreatePrivateCampaignResult = { ok: boolean; rfqId?: string; error?: string };
export type OneStepRfqResult =
  | { ok: true; distintaId: string; rfqId: string }
  | { ok: false; distintaId: string | null; phase: "save" | "create"; error: string };

export async function createPrivateRfqOneStep(input: {
  existingDistintaId: string | null;
  save: () => Promise<SaveSnapshotResult>;
  create: (savedId: string) => Promise<CreatePrivateCampaignResult>;
  onSaved?: (id: string) => void;
}): Promise<OneStepRfqResult> {
  let id = input.existingDistintaId;
  if (!id) {
    try {
      const saved = await input.save();
      if (!saved.ok || !saved.distintaId) {
        return { ok: false, distintaId: null, phase: "save",
          error: saved.error || "Impossibile salvare la distinta. Riprova." };
      }
      id = saved.distintaId;
      input.onSaved?.(id);
    } catch {
      return { ok: false, distintaId: null, phase: "save",
        error: "Il salvataggio non è riuscito. Verifica la connessione prima di riprovare." };
    }
  }
  try {
    const rfq = await input.create(id);
    if (rfq.ok && rfq.rfqId) return { ok: true, distintaId: id, rfqId: rfq.rfqId };
    return { ok: false, distintaId: id, phase: "create",
      error: (rfq.error || "Non è stato possibile creare la RFQ.") +
        " La distinta è già salvata: puoi riprovare senza duplicarla." };
  } catch {
    return { ok: false, distintaId: id, phase: "create",
      error: "La distinta è salvata, ma la RFQ non è stata confermata. Riprova: verificheremo anche le RFQ già create." };
  }
}
