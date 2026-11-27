/** Actual stored publication state, distinct from a request to publish. */
export function companyContactPublication(status: string) {
  if (status === "published") return { label: "Pubblicato", requested: "published" } as const;
  if (status === "pending_review") return { label: "In revisione", requested: "published" } as const;
  if (status === "draft") return { label: "Bozza privata", requested: "draft" } as const;
  if (status === "archived") return { label: "Archiviato", requested: "draft" } as const;
  return { label: "Visibilità da verificare", requested: "draft" } as const;
}

/** Use the writer's receipt: a publication request is not a publication. */
export function companyContactSaveMessage(receipt: unknown, expectedContactId: string | null = null): string | null {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return null;
  const value = receipt as Record<string, unknown>;
  if (typeof value.contact_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.contact_id)
    || value.created !== (expectedContactId === null) || value.privacy_review_required !== true
    || (expectedContactId !== null && value.contact_id !== expectedContactId)) return null;
  const status = value.publication_status;
  if (status === "pending_review") return "Contatto salvato e inviato in revisione. Sarà visibile nel Network dopo l’approvazione.";
  if (status === "draft") return "Contatto salvato come bozza privata.";
  return null;
}
