/**
 * Chat RFQ, passo 2: fornitori suggeriti.
 * Funzione pura sui candidati già calcolati da `rfqh2_supplier_candidates`.
 * Non invia nulla: il suggerimento diventa un'aggiunta solo con un clic esplicito.
 */
export type SuggestionSource =
  | "recent" | "private_contact" | "private_company"
  | "network_contact" | "network_company" | "platform_organization";

export type SuggestionCandidate = {
  identity_key: string;
  source: SuggestionSource;
  company_name: string | null;
  email: string | null;
  preferred: boolean;
  last_used_at: string | null;
};

export type SupplierSuggestion<T extends SuggestionCandidate = SuggestionCandidate> = {
  candidate: T;
  reason: string;
};

const REASON: Record<SuggestionSource, string> = {
  recent: "Già usato in precedenti richieste",
  private_contact: "Nei tuoi contatti",
  private_company: "Nei tuoi contatti",
  network_contact: "Nel Network",
  network_company: "Nel Network",
  platform_organization: "Iscritto a Smart Steel Sales",
};
const ORDER: Record<SuggestionSource, number> = {
  recent: 0, private_contact: 1, private_company: 1,
  network_contact: 2, network_company: 2, platform_organization: 3,
};

const norm = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase("it-IT");

/** Preferiti prima, poi già usati, contatti privati, Network; esclude chi è già nella RFQ. */
export function rankSupplierSuggestions<T extends SuggestionCandidate>(
  candidates: readonly T[],
  existing: { emails: readonly string[]; names: readonly string[] },
  limit = 6,
): SupplierSuggestion<T>[] {
  const emails = new Set(existing.emails.map(norm).filter(Boolean));
  const names = new Set(existing.names.map(norm).filter(Boolean));
  const seen = new Set<string>();
  return candidates
    .filter((c) => {
      const email = norm(c.email), name = norm(c.company_name);
      if ((email && emails.has(email)) || (name && names.has(name))) return false;
      const key = c.identity_key;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(email || c.source === "platform_organization" || c.source.startsWith("network"));
    })
    .sort((a, b) =>
      Number(b.preferred) - Number(a.preferred) ||
      ORDER[a.source] - ORDER[b.source] ||
      (Date.parse(b.last_used_at ?? "") || 0) - (Date.parse(a.last_used_at ?? "") || 0) ||
      norm(a.company_name).localeCompare(norm(b.company_name), "it"))
    .slice(0, Math.max(0, limit))
    .map((candidate) => ({
      candidate,
      reason: candidate.preferred ? "Fornitore preferito" : REASON[candidate.source],
    }));
}
