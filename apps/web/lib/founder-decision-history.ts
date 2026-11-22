import "server-only";

import { createClient } from "@/lib/supabase/server";

const HISTORY_ACTIONS = {
  registration_application_approved: {
    title: "Registrazione aziendale approvata",
    effect: "Richiesta approvata. L'attivazione del workspace è un passaggio distinto.",
    area: "/platform/registrations",
  },
  registration_workspace_activated: {
    title: "Workspace aziendale attivato",
    effect: "L'attivazione del workspace è stata registrata.",
    area: "/platform/registrations",
  },
  company_claim_proof_verified: {
    title: "Prova di proprietà verificata",
    effect: "La prova presentata è stata verificata; l'approvazione della rivendicazione resta distinta.",
    area: "/platform/company-claims",
  },
  company_claim_approved: {
    title: "Rivendicazione aziendale approvata",
    effect: "La richiesta di gestione della scheda aziendale è stata approvata.",
    area: "/platform/company-claims",
  },
  company_claim_revoked: {
    title: "Gestione scheda aziendale revocata",
    effect: "La precedente autorizzazione a gestire la scheda è stata revocata.",
    area: "/platform/company-claims",
  },
  discovery_candidate_published: {
    title: "Scheda aziendale pubblicata",
    effect: "La pubblicazione della scheda nel Network è stata registrata.",
    area: "/platform/company-discovery",
  },
  discovery_exact_duplicates_closed: {
    title: "Duplicati esatti chiusi",
    effect: "È stata registrata la chiusura dei duplicati identificati.",
    area: "/platform/company-discovery",
  },
  network_verification_verified: {
    title: "Verifica Network completata",
    effect: "È stato registrato l'esito positivo della verifica.",
    area: "/platform/network-trust",
  },
} as const;

export type FounderHistoryAction = keyof typeof HISTORY_ACTIONS;
export type FounderHistoryEntry = {
  id: string;
  at: string;
  title: string;
  effect: string;
  actor: "Fondatore" | "Team autorizzato" | "Non specificato";
  href: string;
};
export type FounderDecisionHistory = {
  status: "verified" | "unavailable";
  entries: FounderHistoryEntry[];
  checkedAt: string | null;
  hasMore: boolean;
  nextCursor: string | null;
};

type RawRecord = Record<string, unknown>;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(input: unknown): RawRecord | null {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as RawRecord
    : null;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length < 80 &&
    Number.isFinite(Date.parse(value));
}

function knownAction(value: unknown): value is FounderHistoryAction {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(HISTORY_ACTIONS, value);
}

function parseCursor(value: string | undefined): { at: string; id: string } | null {
  if (!value || value.length > 150) return null;
  const splitAt = value.lastIndexOf("|");
  if (splitAt < 1) return null;
  const at = value.slice(0, splitAt);
  const id = value.slice(splitAt + 1);
  return validDate(at) && uuidPattern.test(id) ? { at, id } : null;
}

function toHistoryEntry(input: unknown): FounderHistoryEntry | null {
  const item = record(input);
  if (!item || !knownAction(item.action) ||
      typeof item.id !== "string" || !uuidPattern.test(item.id) ||
      !validDate(item.at)) return null;
  const info = HISTORY_ACTIONS[item.action];
  const href = item.entity_type === "registration_application" &&
    typeof item.entity_id === "string" && uuidPattern.test(item.entity_id) &&
    (item.action === "registration_application_approved" ||
     item.action === "registration_workspace_activated")
    ? "/platform/registrations/" + item.entity_id
    : info.area;

  return {
    id: item.id,
    at: item.at,
    title: info.title,
    effect: info.effect,
    href,
    actor: item.actor_type === "founder" ? "Fondatore"
      : item.actor_type === "staff" ? "Team autorizzato" : "Non specificato",
  };
}

/** Server-only read. The RPC rechecks Platform Owner authority in SQL. */
export async function getFounderDecisionHistory(cursor?: string): Promise<FounderDecisionHistory> {
  const unavailable: FounderDecisionHistory = {
    status: "unavailable", entries: [], checkedAt: null, hasMore: false, nextCursor: null,
  };
  const before = parseCursor(cursor);
  if (cursor && !before) return unavailable;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("sss_founder_decision_history_read", {
      p_limit: 20,
      p_before_at: before?.at ?? null,
      p_before_id: before?.id ?? null,
    });
    if (error) return unavailable;

    const payload = record(data);
    if (!payload || !Array.isArray(payload.events) ||
        typeof payload.has_more !== "boolean" ||
        !validDate(payload.checked_at) ||
        payload.source !== "platform_access_events") return unavailable;

    const entries = payload.events.map(toHistoryEntry).filter(
      (item): item is FounderHistoryEntry => item !== null
    );
    // Fail closed on unexpected audit event formats instead of silently hiding rows.
    if (entries.length !== payload.events.length) return unavailable;

    const last = entries.at(-1);
    return {
      status: "verified",
      entries,
      checkedAt: payload.checked_at,
      hasMore: payload.has_more,
      nextCursor: payload.has_more && last ? last.at + "|" + last.id : null,
    };
  } catch {
    return unavailable;
  }
}
