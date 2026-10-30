"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

const BASE = "/platform/steel-pulse/workflow";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOPICS = new Set(["market","trade","regulation","raw_materials","technology","companies"]);
const RESPONSES = {
  saved: "Bozza salvata. Nessun contenuto pubblico aggiornato.",
  submitted: "Bozza inviata alla revisione indipendente.",
  approved: "Fact-check editoriale approvato. Non è una pubblicazione.",
  rejected: "Modifiche richieste all’autore. Nessun contenuto pubblicato.",
  invalid: "Controlla campi, revisione e fonte. Nessuna modifica effettuata.",
  denied: "Operazione non autorizzata o revisione non più valida.",
} as const;
type Outcome = keyof typeof RESPONSES;
type Action = "save" | "submit" | "editor_approve" | "editor_reject";

function field(data: FormData, name: string, max = 2200) {
  const v = data.get(name);
  if (typeof v !== "string" || v.length > max) return null;
  return v.trim();
}
function destination(item: string | null, outcome: Outcome) {
  const qs = new URLSearchParams({ outcome });
  if (item && UUID.test(item)) qs.set("item", item);
  return BASE + "?" + qs.toString();
}
function done(item: string | null, result: Outcome): never {
  revalidatePath(BASE);
  redirect(destination(item, result));
}
function original(text: string | null, min: number, max: number) {
  return text !== null && text.length >= min && text.length <= max
    && !/<|>|https?:\/\/|www\./i.test(text);
}

async function authorize(permission: "knowledge.edit" | "knowledge.review") {
  // Uses the real GoTrue identity and current database Platform permissions.
  const context = await requirePlatformConsoleContext();
  if (!context.permissions.includes("knowledge.read_drafts") ||
      !context.permissions.includes(permission)) redirect("/platform");
  return context;
}
async function resolveItem(itemId: string) {
  // All mutations must resolve the current visible item through SP3 and recheck
  // revision/author/status on the server. SQL RPC remains the authoritative gate.
  const db = await createClient();
  const { data, error } = await db.rpc("sp3_editorial_detail", { p_item_id: itemId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const source = row.source;
  const card = row.card;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const s = source as Record<string, unknown>;
  if (s.item_id !== itemId || typeof s.source_status !== "string") return null;
  if (card !== null && (!card || typeof card !== "object" || Array.isArray(card))) return null;
  return { db, source: s, card: card as Record<string, unknown> | null };
}

export async function saveSteelPulseDraft(data: FormData) {
  const actor = await authorize("knowledge.edit");
  const item = field(data, "item", 40);
  const revisionText = field(data, "revision", 12);
  const headline = field(data, "headline", 160);
  const summary = field(data, "summary", 650);
  const relevance = field(data, "relevance", 380);
  const topic = field(data, "topic", 40);
  const language = field(data, "language", 10);
  const revision = revisionText === null || !/^\d{1,8}$/.test(revisionText)
    ? -1 : Number(revisionText);
  if (!item || !UUID.test(item) || revision < 0 ||
      !original(headline, 25, 160) || !original(summary, 60, 650) ||
      !original(relevance, 40, 380) || !topic || !TOPICS.has(topic) ||
      !["it","en"].includes(language ?? "")) done(item, "invalid");
  const current = await resolveItem(item);
  if (!current || current.source.source_status !== "approved" ||
      (current.card !== null &&
       (current.card.status !== "draft" ||
        current.card.authored_by !== actor.user_id ||
        current.card.revision !== revision)) ||
      (current.card === null && revision !== 0)) done(item, "denied");
  const { error } = await current.db.rpc("sp3_save_draft", {
    p_item_id: item, p_expected_revision: revision,
    p_headline: headline, p_summary: summary, p_relevance: relevance,
    p_topic: topic, p_language: language,
  });
  if (error) done(item, "denied");
  done(item, "saved");
}

export async function submitSteelPulseDraft(data: FormData) {
  const actor = await authorize("knowledge.edit");
  const item = field(data, "item", 40);
  const revisionText = field(data, "revision", 12);
  const reason = field(data, "reason", 2000);
  const revision = revisionText && /^\d{1,8}$/.test(revisionText) ? Number(revisionText) : -1;
  if (!item || !UUID.test(item) || revision < 1 ||
      !reason || reason.length < 8) done(item, "invalid");
  const current = await resolveItem(item);
  if (!current || !current.card ||
      current.card.authored_by !== actor.user_id ||
      current.card.status !== "draft" || current.card.revision !== revision ||
      typeof current.card.id !== "string" || !UUID.test(current.card.id)) done(item, "denied");
  const { error } = await current.db.rpc("sp3_decide", {
    p_card_id: current.card.id, p_revision: revision,
    p_action: "submit", p_evidence_url: null, p_reason: reason,
  });
  if (error) done(item, "denied");
  done(item, "submitted");
}

export async function reviewSteelPulseDraft(data: FormData) {
  const actor = await authorize("knowledge.review");
  const item = field(data, "item", 40);
  const revisionText = field(data, "revision", 12);
  const action = field(data, "decision", 30) as Action | null;
  const reason = field(data, "reason", 2000);
  const evidence = field(data, "evidence", 1024);
  const revision = revisionText && /^\d{1,8}$/.test(revisionText) ? Number(revisionText) : -1;
  if (!item || !UUID.test(item) || revision < 1 ||
      !["editor_approve","editor_reject"].includes(action ?? "") ||
      !reason || reason.length < 8) done(item, "invalid");
  if (action === "editor_approve" && (!evidence || !/^https:\/\/[^\s]+$/.test(evidence))) done(item, "invalid");
  const current = await resolveItem(item);
  if (!current || !current.card ||
      current.card.status !== "in_review" ||
      current.card.authored_by === actor.user_id ||
      current.card.revision !== revision ||
      typeof current.card.id !== "string" || !UUID.test(current.card.id)) done(item, "denied");
  const { error } = await current.db.rpc("sp3_decide", {
    p_card_id: current.card.id, p_revision: revision,
    p_action: action, p_evidence_url: action === "editor_approve" ? evidence : null,
    p_reason: reason,
  });
  if (error) done(item, "denied");
  done(item, action === "editor_approve" ? "approved" : "rejected");
}
