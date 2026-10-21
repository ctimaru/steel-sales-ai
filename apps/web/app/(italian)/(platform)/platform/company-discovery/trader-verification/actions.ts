"use server";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";

/**
 * Deprecated TRADER1D.2 mutation entrypoint.
 *
 * TRADER1D.3A removes platform-managed approval as a prerequisite for
 * company growth. Keep this server action fail-closed if an old browser
 * form or cached action token tries to submit after the UX change.
 * The immutable historic ledger is retained for audit compatibility.
 */
export async function recordTraderReview(_formData: FormData): Promise<never> {
  await requirePlatformSuperadmin();
  throw new Error("Revisione manuale commercianti disattivata: monitoraggio automatico e claim aziendale.");
}
