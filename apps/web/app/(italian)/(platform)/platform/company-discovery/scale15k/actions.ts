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

/** NET-IT-AUTO3: separate, explicit Owner authorization for narrow first-party
 * factual company publication. This is NOT a declaration of source license,
 * and never modifies a human source-governance decision. */
export async function setScale15KFactPolicy(formData: FormData) {
  await requirePlatformPermission("platform.settings.manage");
  await requirePlatformPermission("discovery.publish");
  const supabase = await createClient();
  const { data: access, error: accessError } = await supabase.rpc("platform_access_context");
  if (accessError || !(access as { is_platform_owner?: boolean } | null)?.is_platform_owner) {
    redirect(resultPath("error", "Solo il proprietario Platform può autorizzare o revocare la pubblicazione automatica dei fatti aziendali."));
  }
  const enabled = formData.get("enabled") === "true";
  const attested = formData.get("attested") === "on";
  const note = String(formData.get("policy_note") ?? "").trim();
  const cap = Number(formData.get("daily_cap") ?? 100);
  if (enabled && (!attested || !Number.isInteger(cap) || cap < 1 || cap > 300 ||
      note.length < 100 || note.length > 2000)) {
    redirect(resultPath("error",
      "Delega non concessa: seleziona 1–300 al giorno, motivazione da almeno 100 caratteri e conferma delle condizioni."));
  }
  const { data, error } = await supabase.rpc("net_it_auto3_set_policy", {
    p_enabled: enabled, p_daily_cap: enabled ? cap : 100,
    p_valid_days: 30, p_attested: enabled ? attested : false,
    p_note: enabled ? note : null,
  });
  const result = data as { contract?: string; enabled?: boolean } | null;
  if (error || result?.contract !== "net-it-auto3-policy-v1" ||
      result.enabled !== enabled) {
    redirect(resultPath("error",
      "Delega fatti aziendali non modificata: controlla i permessi Platform e l'installazione del motore."));
  }
  revalidatePath(ROOT);
  redirect(resultPath("message",enabled
    ? "Delega fatti aziendali attiva per 30 giorni. Solo verifiche recenti del sito ufficiale, quota giornaliera e audit macchina."
    : "Delega fatti aziendali revocata: il motore automatico non potrà effettuare nuovi lotti."));
}

/** NET-IT-SEED1: owner authorization to keep discovering new Italian company
 * websites from index pages (association/fair/certification lists), at a
 * daily-capped rate. Finds domains and stages private PENDING candidates
 * only — it never publishes and never marks a source as approved. */
export async function setSeed1Policy(formData: FormData) {
  await requirePlatformPermission("platform.settings.manage");
  await requirePlatformPermission("discovery.run");
  const supabase = await createClient();
  const { data: access, error: accessError } = await supabase.rpc("platform_access_context");
  if (accessError || !(access as { is_platform_owner?: boolean } | null)?.is_platform_owner) {
    redirect(resultPath("error", "Solo il proprietario Platform può autorizzare o revocare il cercatore di siti."));
  }
  const enabled = formData.get("enabled") === "true";
  const attested = formData.get("attested") === "on";
  const note = String(formData.get("policy_note") ?? "").trim();
  const cap = Number(formData.get("daily_crawl_cap") ?? 1000);
  if (enabled && (!attested || !Number.isInteger(cap) || cap < 1 || cap > 5000 ||
      note.length < 80 || note.length > 2000)) {
    redirect(resultPath("error",
      "Cercatore non attivato: seleziona 1–5000 siti al giorno e una motivazione di almeno 80 caratteri."));
  }
  const { data, error } = await supabase.rpc("net_it_seed1_set_policy", {
    p_enabled: enabled, p_daily_crawl_cap: enabled ? cap : 1000,
    p_valid_days: 30, p_attested: enabled ? attested : false,
    p_note: enabled ? note : null,
  });
  const result = data as { contract?: string; enabled?: boolean } | null;
  if (error || result?.contract !== "net-it-seed1-policy-v1" ||
      result.enabled !== enabled) {
    redirect(resultPath("error",
      "Cercatore di siti non modificato: controlla i permessi Platform e l'installazione della funzione."));
  }
  revalidatePath(ROOT);
  redirect(resultPath("message", enabled
    ? "Cercatore di siti attivo per 30 giorni: trova solo domini aziendali italiani e li metterà in coda come candidature private, mai pubblicate automaticamente."
    : "Cercatore di siti revocato: nessuna nuova pagina indice verrà letta."));
}

/** Registers one index page (association member list, trade-fair exhibitor
 * list, certification list...) as a pointer source for NET-IT-SEED1. Only
 * the outbound company domains found on it are ever kept. */
export async function addSeed1Source(formData: FormData) {
  await requirePlatformPermission("discovery.run");
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  const sourceKind = String(formData.get("source_kind") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const maxLinks = Number(formData.get("max_links") ?? 300);
  const kinds = ["association", "trade_fair", "certification_list", "consortium", "public_register", "other"];
  if (!/^https:\/\/\S+$/.test(sourceUrl) || sourceUrl.length > 2000 ||
      !kinds.includes(sourceKind) || !Number.isInteger(maxLinks) || maxLinks < 1 || maxLinks > 1000) {
    redirect(resultPath("error",
      "Pagina indice non aggiunta: serve un indirizzo https valido, un tipo di fonte e un limite di link tra 1 e 1000."));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("net_it_seed1_add_source", {
    p_source_url: sourceUrl, p_source_kind: sourceKind,
    p_label: label || null, p_max_links: maxLinks,
  });
  const result = data as { contract?: string; created?: boolean } | null;
  if (error || result?.contract !== "net-it-seed1-source-v1") {
    redirect(resultPath("error",
      "Pagina indice non registrata: controlla il permesso discovery.run e l'indirizzo inserito."));
  }
  revalidatePath(ROOT);
  redirect(resultPath("message", result?.created
    ? "Pagina indice registrata: verrà letta al prossimo giro del cercatore, solo per i domini aziendali in uscita."
    : "Pagina indice già registrata: nessuna duplicazione creata."));
}
