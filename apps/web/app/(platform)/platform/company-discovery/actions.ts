"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformContext } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/server";

function discoveryPath(key: "message" | "error", value: string) {
  return `/platform/company-discovery?${key}=${encodeURIComponent(value)}`;
}

function candidateId(formData: FormData) {
  return String(formData.get("candidate_id") ?? "").trim();
}

export async function startCompanyDiscovery(formData: FormData) {
  await requirePlatformContext();

  const countryCode = String(formData.get("country_code") ?? "IT")
    .trim()
    .toUpperCase();
  const rawSeeds = String(formData.get("seed_urls") ?? "");
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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p3_start_company_discovery", {
    p_country_code: countryCode,
    p_seed_urls: seedUrls,
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
      `Discovery accodata su ${seedUrls.length} seed. Run ${runId.slice(0, 8)}.`,
    ),
  );
}

export async function reviewCompanyDiscovery(formData: FormData) {
  await requirePlatformContext();

  const id = candidateId(formData);
  const decision = String(formData.get("decision") ?? "").trim();
  const existingCompanyId =
    String(formData.get("existing_company_id") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!id) redirect(discoveryPath("error", "Candidato non valido."));
  if (!["publish_new", "reject", "duplicate_existing"].includes(decision)) {
    redirect(discoveryPath("error", "Decisione non valida."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("p3_review_company_discovery", {
    p_candidate_id: id,
    p_decision: decision,
    p_existing_company_id: existingCompanyId,
    p_note: note,
  });

  if (error) {
    redirect(discoveryPath("error", error.message));
  }

  revalidatePath("/platform/company-discovery");
  revalidatePath("/network");
  redirect(
    discoveryPath(
      "message",
      decision === "publish_new"
        ? "Profilo pubblicato nel Network come unclaimed + unverified."
        : decision === "duplicate_existing"
          ? "Candidato segnato come identità già esistente. Nessun merge eseguito."
          : "Candidato rifiutato.",
    ),
  );
}
