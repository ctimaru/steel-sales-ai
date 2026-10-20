"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

const dimensions = [
  "legal_identity", "trader_role", "product_evidence",
  "domain_reconciliation", "reuse_rights", "facility_source",
] as const;
const euCountries = [
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU",
  "IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK",
];

function safeSource(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
        !url.hostname || value.length > 500) return null;
    return url.href;
  } catch {
    return null;
  }
}

function destination(id: string, country: string, key: "message" | "error", feedback: string) {
  const qs = new URLSearchParams({ id, [key]: feedback });
  if (euCountries.includes(country)) qs.set("country", country);
  return `/platform/company-discovery/trader-verification?${qs.toString()}`;
}

export async function recordTraderReview(formData: FormData) {
  // Page access is not authorization. Re-check fresh identity on every mutation.
  await requirePlatformSuperadmin();

  const id = String(formData.get("research_id") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const dimension = String(formData.get("dimension") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const rawSource = String(formData.get("evidence_url") ?? "").trim();
  const evidenceUrl = safeSource(rawSource);
  const legalName = String(formData.get("legal_name") ?? "").trim();
  const legalCountry = String(formData.get("legal_country") ?? "").trim();
  const permissionBasis = String(formData.get("permission_basis") ?? "").trim();
  const permissionScope = String(formData.get("permission_scope") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id)
      || !dimensions.includes(dimension as (typeof dimensions)[number])
      || !["accepted","hold","rejected"].includes(decision)
      || note.length < 20 || note.length > 800
      || (rawSource !== "" && !evidenceUrl)
      || (decision === "accepted" && !evidenceUrl)
      || (dimension === "legal_identity" && decision === "accepted" &&
          (legalName.length < 3 || legalName.length > 180 || !euCountries.includes(legalCountry)))
      || (dimension === "reuse_rights" && decision === "accepted" &&
          (!["written_permission","written_license","open_license"].includes(permissionBasis)
          || !["internal_research","network_profile","network_facility"].includes(permissionScope)))
  ) {
    redirect(destination(id, country, "error", "Campi non validi: controlla evidenza HTTPS, dimensione e motivazione (20–800 caratteri)."));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("trader1d2_record_decision", {
    p_research_id: id,
    p_dimension: dimension,
    p_decision: decision,
    p_evidence_url: evidenceUrl,
    p_note: note,
    p_legal_name: dimension === "legal_identity" ? legalName || null : null,
    p_legal_country: dimension === "legal_identity" ? legalCountry || null : null,
    p_permission_basis: dimension === "reuse_rights" ? permissionBasis || null : null,
    p_permission_scope: dimension === "reuse_rights" ? permissionScope || null : null,
  });

  if (error) {
    // Fail closed; never disclose table/role/DB internals in redirects.
    redirect(destination(id, country, "error",
      "Decisione non registrata. Controlla i campi o lo stato delle migrazioni Supabase."));
  }

  revalidatePath("/platform/company-discovery/trader-verification");
  redirect(destination(id, country, "message",
    "Decisione registrata nel ledger privato. Nessuna azienda pubblicata o verificata automaticamente."));
}
