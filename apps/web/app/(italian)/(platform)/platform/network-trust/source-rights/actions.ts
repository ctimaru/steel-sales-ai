"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

const BASE = "/platform/network-trust/source-rights";
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const KINDS = new Set(["discovery_candidate","source_assessment","data_assertion","canonical_evidence"]);
const USES = new Set(["discovery","factual_profile","excerpt_republication","ai_retrieval","ai_training","bulk_redistribution","paid_network"]);
const DECISIONS = new Set(["needs_review","allowed","limited","blocked","revoked"]);

function field(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}
function returnRoute(raw: string) {
  try {
    const u = new URL(raw, "https://internal.invalid");
    return u.pathname === BASE ? BASE + (u.search || "") : BASE;
  } catch { return BASE; }
}
function finish(target: string, outcome: "saved" | "error") {
  const u = new URL(target, "https://internal.invalid");
  u.searchParams.delete("saved");
  u.searchParams.delete("error");
  u.searchParams.set(outcome, "1");
  redirect(BASE + "?" + u.searchParams.toString());
}

export async function recordRightsDecision(data: FormData) {
  // Server-side + authoritative database permission both required.
  await requirePlatformSuperadmin();
  const returnPath = returnRoute(field(data,"return_path"));
  const kind = field(data,"evidence_kind");
  const evidence = field(data,"evidence_id");
  const scope = field(data,"use_scope");
  const decision = field(data,"decision");
  const basis = field(data,"rights_basis");
  const proof = field(data,"evidence_url");
  const terms = field(data,"terms_version");
  const note = field(data,"review_note");
  const attribution = field(data,"attribution_requirements");
  const expiry = field(data,"valid_until");
  const expected = field(data,"expected_decision_id");
  const grant = decision==="allowed" || decision==="limited";

  if (!KINDS.has(kind) || !UUID.test(evidence) || !USES.has(scope)
      || !DECISIONS.has(decision) || note.length<12 || note.length>1500
      || (expected!==""&&!UUID.test(expected))) finish(returnPath,"error");

  let until: string | null = null;
  if (expiry) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) finish(returnPath,"error");
    const time = Date.parse(expiry+"T23:59:59.000Z");
    if (!Number.isFinite(time) || time<=Date.now()) finish(returnPath,"error");
    until = new Date(time).toISOString();
  }
  if (grant) {
    if (!["explicit_permission","open_license","first_party_submission","counsel_approved"].includes(basis)
      || terms.length<2 || terms.length>180 || !until || note.length<20) finish(returnPath,"error");
    try {
      const u = new URL(proof);
      if (u.protocol!=="https:" || u.username || u.password || proof.length>1800) finish(returnPath,"error");
    } catch { finish(returnPath,"error"); }
  }

  const client = await createClient();
  const {data: auth, error: authError} = await client.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const {data: response,error} = await client.rpc("trust_c2g3_record_rights_decision",{
    p_evidence_kind:kind,p_evidence_id:evidence,p_use_scope:scope,p_decision:decision,
    p_rights_basis:basis||null,p_evidence_url:proof||null,
    p_terms_version:terms||null,p_review_note:note,
    p_attribution_requirements:attribution||null,
    p_valid_until:until,p_expected_decision_id:expected||null,
  });
  if (error || (response as {status?: string}|null)?.status!=="recorded") finish(returnPath,"error");
  revalidatePath(BASE);
  finish(returnPath,"saved");
}
