"use server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { communityIntakeConfig, communityNoticeVersion, communityPath } from "@/lib/community-intake-config";

export async function submitCommunityInterest(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "it";
  const kind = form.get("kind") === "investor" ? "investor" : "partner";
  const back = communityPath(locale, kind);
  const config = communityIntakeConfig();
  if (!config.enabled) redirect(back + "&result=closed");
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const name = text("name"), email = text("email").toLowerCase(), organization = text("organization");
  const token = text("cf-turnstile-response");
  if (!["partner","investor"].includes(text("kind")) || name.length < 2 || name.length > 120 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      organization.length > 160 || (kind === "partner" && !organization) ||
      text("privacy") !== "on" || text("website_check") || !token || token.length > 2048) {
    redirect(back + "&result=invalid");
  }
  let verified = false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method:"POST", body:new URLSearchParams({secret:process.env.MKT9_TURNSTILE_SECRET!,response:token}),
      cache:"no-store", signal:AbortSignal.timeout(8000),
    });
    const result = await response.json() as {success?:boolean;hostname?:string;action?:string};
    verified = response.ok && result.success === true && result.hostname === config.hostname && result.action === "community_interest";
  } catch { /* fail closed without logging PII */ }
  if (!verified) redirect(back + "&result=invalid");
  let accepted = false;
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.MKT9_COMMUNITY_SUPABASE_SECRET!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {error} = await db.from("mkt9_community_interest").insert({
      kind, locale, name, email, organization:organization || null, notice_version:communityNoticeVersion,
      challenge_digest:createHash("sha256").update(token).digest("hex"),
    });
    // Same response for duplicate email or challenge; no enumeration or overwrite.
    accepted = !error || error.code === "23505";
  } catch { /* no contact data or provider details in logs */ }
  redirect(back + (accepted ? "&result=received" : "&result=unavailable"));
}
