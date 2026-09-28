"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

function discoveryPath(key: "message" | "error", value: string) {
  return `/platform/company-discovery?${key}=${encodeURIComponent(value)}`;
}

function candidateId(formData: FormData) {
  return String(formData.get("candidate_id") ?? "").trim();
}

export async function startCompanyDiscovery(formData: FormData) {
  await requirePlatformPermission("discovery.run");

  const countryCode = String(formData.get("country_code") ?? "IT")
    .trim()
    .toUpperCase();
  const rawSeeds = String(formData.get("seed_urls") ?? "");
  const sourceType = String(formData.get("source_type") ?? "manual_url").trim();
  const label = String(formData.get("label") ?? "").trim() || "Manual Company Discovery";
  const sourceReference =
    String(formData.get("source_reference") ?? "").trim() ||
    "Platform Company Discovery form";
  const seedUrls = Array.from(
    new Set(
      rawSeeds
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    redirect(discoveryPath("error", "Codice paese non valido."));
  }
  if (seedUrls.length < 1 || seedUrls.length > 100) {
    redirect(discoveryPath("error", "Inserisci da 1 a 100 URL pubblici."));
  }
  if (seedUrls.some((value) => !/^https?:\/\//i.test(value))) {
    redirect(discoveryPath("error", "Ogni seed deve essere un URL http(s) assoluto."));
  }
  if (
    ![
      "manual_url",
      "web_search_curated",
      "industry_directory",
      "association",
      "registry",
      "other",
    ].includes(sourceType)
  ) {
    redirect(discoveryPath("error", "Tipo fonte discovery non valido."));
  }
  if (label.length > 255) {
    redirect(discoveryPath("error", "Etichetta campagna troppo lunga."));
  }
  if (sourceReference.length > 2000) {
    redirect(discoveryPath("error", "Riferimento fonte troppo lungo."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p3_start_company_discovery_batch", {
    p_country_code: countryCode,
    p_seed_urls: seedUrls,
    p_source_type: sourceType,
    p_source_reference: sourceReference,
    p_label: label,
  });

  if (error) {
    redirect(discoveryPath("error", error.message));
  }

  const runId = String((data as { run_id?: string } | null)?.run_id ?? "");
  if (!runId) {
    redirect(discoveryPath("error", "Run di discovery non creato."));
  }

  // The Railway worker polls the durable Supabase queue autonomously.
  // No worker secret is exposed to or required by the Vercel frontend.

  revalidatePath("/platform/company-discovery");
  redirect(
    discoveryPath(
      "message",
      `${label}: discovery accodata su ${seedUrls.length} seed. Run ${runId.slice(0, 8)}.`,
    ),
  );
}

export async function reviewCompanyDiscovery(formData: FormData) {
  const id = candidateId(formData);
  const decision = String(formData.get("decision") ?? "").trim();

  await requirePlatformPermission("discovery.review");
  if (decision === "publish_new") {
    await requirePlatformPermission("discovery.publish");
  }
  if (decision === "enrich_existing") {
    await requirePlatformPermission("discovery.enrich");
  }
  const existingCompanyId =
    String(formData.get("existing_company_id") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const includeFacilities = formData.get("include_facilities") === "on";
  const capabilityKeys = Array.from(
    new Set(
      formData
        .getAll("capability_key")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
  const marketKeys = Array.from(
    new Set(
      formData
        .getAll("market_key")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );

  if (!id) redirect(discoveryPath("error", "Candidato non valido."));
  if (!["publish_new", "reject", "duplicate_existing", "enrich_existing"].includes(decision)) {
    redirect(discoveryPath("error", "Decisione non valida."));
  }
  if (
    decision === "enrich_existing" &&
    !includeFacilities &&
    capabilityKeys.length === 0 &&
    marketKeys.length === 0
  ) {
    redirect(
      discoveryPath(
        "error",
        "Seleziona almeno una facility, capability o mercato da approvare.",
      ),
    );
  }

  const supabase = await createClient();
  const result =
    decision === "enrich_existing"
      ? await supabase.rpc("p3_enrich_existing_company_discovery_selected", {
          p_candidate_id: id,
          p_existing_company_id: existingCompanyId,
          p_note: note,
          p_include_facilities: includeFacilities,
          p_capability_keys: capabilityKeys,
          p_market_keys: marketKeys,
        })
      : await supabase.rpc("p3_review_company_discovery", {
          p_candidate_id: id,
          p_decision: decision,
          p_existing_company_id: existingCompanyId,
          p_note: note,
        });

  if (result.error) {
    redirect(discoveryPath("error", result.error.message));
  }

  revalidatePath("/platform/company-discovery");
  revalidatePath("/network");
  redirect(
    discoveryPath(
      "message",
      decision === "publish_new"
        ? "Profilo pubblicato nel Network come unclaimed + unverified."
        : decision === "enrich_existing"
          ? "Profilo esistente arricchito con evidenza pubblica. Nessun merge o overwrite eseguito."
          : decision === "duplicate_existing"
            ? "Candidato segnato come identità già esistente. Nessun merge eseguito."
            : "Candidato rifiutato.",
    ),
  );
}


export async function closeExactDiscoveryDuplicates() {
  await requirePlatformPermission("discovery.close_duplicates");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p3_close_exact_discovery_duplicates", {
    p_note: "P3.4 explicit bulk review of exact matches without enrichment payload.",
  });

  if (error) {
    redirect(discoveryPath("error", error.message));
  }

  const closed = Number(
    (data as { closed_count?: number } | null)?.closed_count ?? 0,
  );

  revalidatePath("/platform/company-discovery");
  redirect(
    discoveryPath(
      "message",
      `${closed} exact identity match chiusi come duplicati. Nessun merge eseguito.`,
    ),
  );
}
