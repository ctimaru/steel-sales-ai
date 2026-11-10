"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/user-facing-error";

const ROOT = "/platform/company-discovery/scale15k";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resultPath(kind: "message" | "error", message: string) {
  return `${ROOT}?${kind}=${encodeURIComponent(message)}`;
}

/**
 * Publishes the next visible ready wave in a single database transaction:
 * 1..100 reviewed companies, no service-role, no SQL bypass.
 * If one identity/source/role/collision check fails, all writes roll back.
 */
export async function publishScale15KReadyWave(formData: FormData) {
  await requirePlatformPermission("discovery.read");
  await requirePlatformPermission("discovery.governance_review");
  await requirePlatformPermission("discovery.publish");

  const ids = formData.getAll("candidate_id").map((value) => String(value).trim());
  const fingerprint = String(formData.get("manifest_fingerprint") ?? "").trim();
  const note = String(formData.get("review_note") ?? "").trim();
  const attested = formData.get("attested") === "on";

  if (!attested ||
      ids.length < 1 || ids.length > 100 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !UUID.test(id)) ||
      !/^[a-f0-9]{64}$/.test(fingerprint) ||
      note.length < 80 || note.length > 2000) {
    redirect(resultPath("error",
      "Pubblicazione non richiesta: conferma la revisione, seleziona 1–100 aziende e inserisci la motivazione (80–2000 caratteri)."));
  }

  const supabase = await createClient();
  // Re-read the actual first ready wave rather than trusting browser-hidden IDs.
  // The final database RPC also verifies an exact unchanged SHA-256 preview.
  const { data: queue, error: queueError } = await supabase.rpc(
    "net_it_scale15k_readiness",
    { p_lane: "ready", p_limit: 100, p_offset: 0 },
  );
  const items = (queue as { contract?: string; rows?: Array<{ candidate_id: string }> } | null);
  const serverIds = items?.contract === "net-it-scale15k-readiness-v1"
    ? (items.rows ?? []).map((item) => item.candidate_id) : [];
  if (queueError || serverIds.length !== ids.length ||
      ids.some((id, index) => id !== serverIds[index])) {
    redirect(resultPath("error",
      "La lista delle aziende pronte è cambiata. Riapri la pagina e controlla la nuova anteprima."));
  }

  const { data, error } = await supabase.rpc("net_it_scale15k_bulk_publish", {
    p_candidate_ids: ids,
    p_expected_fingerprint: fingerprint,
    p_attested: true,
    p_review_note: note,
    p_commit: true,
  });
  if (error) {
    redirect(resultPath("error",
      safeErrorMessage(error,
        "Nessuna azienda pubblicata: il database ha respinto il lotto. Controlla fonti, duplicati e nuova anteprima.")));
  }

  const result = data as {
    contract?: string;
    status?: string;
    published_count?: number;
    company_ids?: string[];
    original_publisher_default_off?: boolean;
  } | null;
  if (result?.contract !== "net-it-scale15k-bulk-publish-v1" ||
      result?.status !== "published" ||
      result?.published_count !== ids.length ||
      result?.company_ids?.length !== ids.length ||
      result?.original_publisher_default_off !== true) {
    redirect(resultPath("error",
      "Risposta di pubblicazione inattesa: controlla il registro del lotto e il catalogo prima di riprovare."));
  }

  revalidatePath(ROOT);
  revalidatePath("/platform/company-discovery");
  revalidatePath("/platform/company-discovery/governance");
  revalidatePath("/network");
  redirect(resultPath("message",
    `Pubblicazione confermata: ${ids.length} aziende italiane aggiunte al Network. Verifica il catalogo pubblico.`));
}

/**
 * NET-IT-AUTO1: one-time, revocable Platform-owner grant for automated
 * publication of companies already reviewed by real source+candidate reviewers.
 * Not a grant to invent or bypass source review; no action occurs by enabling.
 */
export async function setScale15KAgentDelegation(formData: FormData) {
  await requirePlatformPermission("platform.settings.manage");
  await requirePlatformPermission("discovery.publish");
  const supabase = await createClient();
  const { data: access, error: accessError } = await supabase.rpc("platform_access_context");
  if (accessError || !(access as { is_platform_owner?: boolean } | null)?.is_platform_owner) {
    redirect(resultPath("error", "Solo il proprietario Platform può autorizzare o revocare l'agente."));
  }

  const enabled = formData.get("enabled") === "true";
  const attested = formData.get("attested") === "on";
  const note = String(formData.get("policy_note") ?? "").trim();
  const cap = Number(formData.get("daily_cap") ?? "150");
  if (enabled && (
    !attested || !Number.isInteger(cap) || cap < 1 || cap > 500 ||
    note.length < 80 || note.length > 2000
  )) {
    redirect(resultPath("error",
      "Delega non attivata: conferma i limiti, indica 1–500 aziende al giorno e una nota di almeno 80 caratteri."));
  }

  const { data, error } = await supabase.rpc("net_it_auto1_set_delegation", {
    p_enabled: enabled,
    p_daily_cap: enabled ? cap : 150,
    p_valid_days: 30,
    p_attested: enabled ? attested : false,
    p_note: enabled ? note : null,
  });
  const result = data as { contract?: string; enabled?: boolean } | null;
  if (error || result?.contract !== "net-it-auto1-delegation-v1" ||
      result.enabled !== enabled) {
    redirect(resultPath("error",
      "Delega non aggiornata: verifica permessi e installazione del controllo agente."));
  }
  revalidatePath(ROOT);
  redirect(resultPath("message",
    enabled
      ? "Delega attivata per 30 giorni: l'agente potrà pubblicare solo aziende già approvate, entro il limite giornaliero."
      : "Delega revocata. Nessun altro lotto automatico è autorizzato."));
}
