"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

const route = "/platform/company-discovery/sources";
function response(kind: "message" | "error", text: string): never {
  redirect(route + "?" + kind + "=" + encodeURIComponent(text));
}

export async function addDiscoverySource(form: FormData) {
  await requirePlatformPermission("discovery.governance_review");
  const supabase = await createClient();
  const { error } = await supabase.rpc("crawl_it2_register_source", {
    p_name: String(form.get("name") ?? "").trim(),
    p_url: String(form.get("url") ?? "").trim(),
    p_type: String(form.get("type") ?? ""),
  });
  if (error) response("error", "Fonte non registrata. Verifica URL, categoria e duplicati.");
  revalidatePath(route);
  response("message", "Fonte registrata. La scansione rimane disabilitata fino alla revisione.");
}

export async function reviewDiscoverySourceRegistry(form: FormData) {
  await requirePlatformPermission("discovery.governance_review");
  const enable = form.get("enable") === "on";
  const consent = form.get("activation_attested") === "on";
  const decision = String(form.get("decision") ?? "");
  const id = String(form.get("id") ?? "");
  const supabase = await createClient();
  if (enable) {
    if (!consent || decision !== "approved") {
      response("error", "Per abilitare una fonte devi confermare esplicitamente diritti, limiti e assenza di pubblicazione automatica.");
    }
    // CRAWL-IT6.5 initial production activation is restricted to this CC0
    // adapter. Operators may review other sources, but not activate their crawl.
    const { data: sources, error: sourcesError } = await supabase.rpc("crawl_it2_list_sources");
    const item = Array.isArray(sources)
      ? sources.find((candidate: {id?:string;source_url?:string}) => candidate.id === id)
      : null;
    if (sourcesError || item?.source_url !== "https://query.wikidata.org/sparql") {
      response("error", "Nel pilot è abilitabile soltanto Wikidata CC0; altre fonti restano in sola review.");
    }
  }
  const { error } = await supabase.rpc("crawl_it2_review_source", {
    p_id: id,
    p_decision: decision,
    p_terms: String(form.get("terms") ?? ""),
    p_rights: String(form.get("rights") ?? ""),
    p_personal_data: String(form.get("personal_data") ?? ""),
    p_evidence_url: String(form.get("evidence_url") ?? ""),
    p_note: String(form.get("note") ?? ""),
    p_enable: enable,
  });
  if (error) response("error", "Revisione non registrata: controlla diritti, evidenze e autorizzazioni.");
  revalidatePath(route);
  response("message", enable
    ? "Fonte Wikidata approvata e abilitata nel registro. Il worker Railway resta disattivato finché CRAWL_IT3_ENABLED non viene attivato separatamente."
    : "Revisione salvata. Il crawler Railway resta disattivato.");
}

export async function reviewDiscoveredDomain(form: FormData) {
  await requirePlatformPermission("discovery.review");
  const supabase = await createClient();
  const { error } = await supabase.rpc("crawl_it3_review_lead", {
    p_lead_id: String(form.get("lead_id") ?? ""),
    p_decision: String(form.get("decision") ?? ""),
    p_note: String(form.get("note") ?? "").trim(),
  });
  if (error) response("error", "Revisione dominio non completata. Verifica identità, fonte e motivazione.");
  revalidatePath(route);
  revalidatePath("/platform/company-discovery");
  response("message", "Decisione registrata. Solo i domini accettati entrano nella coda crawler, senza pubblicazione automatica.");
}
