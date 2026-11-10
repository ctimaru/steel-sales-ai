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
