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
  const supabase = await createClient();
  const { error } = await supabase.rpc("crawl_it2_review_source", {
    p_id: String(form.get("id") ?? ""),
    p_decision: String(form.get("decision") ?? ""),
    p_terms: String(form.get("terms") ?? ""),
    p_rights: String(form.get("rights") ?? ""),
    p_personal_data: String(form.get("personal_data") ?? ""),
    p_evidence_url: String(form.get("evidence_url") ?? ""),
    p_note: String(form.get("note") ?? ""),
    p_enable: false,
  });
  if (error) response("error", "Revisione non registrata: controlla diritti, evidenze e autorizzazioni.");
  revalidatePath(route);
  response("message", "Revisione salvata. Attivazione automatica non ancora disponibile.");
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
