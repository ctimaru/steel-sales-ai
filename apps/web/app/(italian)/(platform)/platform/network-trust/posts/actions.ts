"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

/**
 * CPOST1: staff moderation of company posts. The Server Action rechecks the
 * exact capability and the RPC enforces it again in SQL.
 */
const BASE = "/platform/network-trust/posts";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECISIONS = new Set(["hide", "restore", "remove"]);

function back(key: "message" | "error", text: string): never {
  redirect(`${BASE}?${key}=${encodeURIComponent(text)}`);
}

export async function moderateCompanyPost(formData: FormData) {
  await requirePlatformPermission("network_trust.posts_moderate", BASE);
  const postId = String(formData.get("post_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);

  if (!UUID.test(postId) || !DECISIONS.has(decision)) back("error", "Richiesta di moderazione non valida.");
  if (decision === "remove" && !note) back("error", "Per rimuovere un post serve una nota per l’audit.");

  const db = await createClient();
  const { data, error } = await db.rpc("cpost1_staff_moderate_post", {
    p_post_id: postId,
    p_decision: decision,
    p_note: note || null,
  });
  if (error) back("error", "Moderazione non riuscita: il post potrebbe essere già stato gestito.");

  const closed = (data as { reports_closed?: unknown } | null)?.reports_closed;
  const count = typeof closed === "number" ? closed : 0;
  revalidatePath(BASE);
  revalidatePath("/dashboard");
  const label = decision === "hide" ? "Post nascosto" : decision === "restore" ? "Post ripristinato" : "Post rimosso";
  back("message", count > 0 ? `${label} · ${count} segnalazioni chiuse.` : `${label}.`);
}
