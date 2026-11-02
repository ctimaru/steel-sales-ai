"use server";

import { redirect } from "next/navigation";

import { optOutRfqRecipient } from "@/lib/rfq-opt-out";

export async function confirmRfqOptOut(form: FormData) {
  const token = String(form.get("token") ?? "");
  const ok = await optOutRfqRecipient(token);
  redirect("/rfq/unsubscribe/" + encodeURIComponent(token) + "?esito=" + (ok ? "ok" : "errore"));
}
