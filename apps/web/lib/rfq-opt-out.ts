import "server-only";

import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

/** RFQ-MAIL1 — recipient opt-out by invite token (no account needed).
 * Only the SHA-256 of the token reaches the database, as for the portal. */
export async function optOutRfqRecipient(token: string): Promise<boolean> {
  const value = token.trim();
  if (!value || value.length > 200) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rfqmail1_opt_out", {
    p_token_hash: createHash("sha256").update(value).digest("hex"),
  });
  return !error && (data as { status?: string } | null)?.status === "opted_out";
}
