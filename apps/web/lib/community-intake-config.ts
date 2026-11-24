import "server-only";
import { legalIdentityConfigured } from "@/lib/legal";
export const communityNoticeVersion = "mkt9c-draft-2026-11-24";
export function communityIntakeConfig() {
  const siteKey = process.env.MKT9_TURNSTILE_SITE_KEY?.trim();
  const hostname = process.env.MKT9_TURNSTILE_HOSTNAME?.trim().toLowerCase();
  const enabled = process.env.MKT9_COMMUNITY_INTAKE_ENABLED === "true" &&
    process.env.MKT9_COMMUNITY_NOTICE_APPROVED === communityNoticeVersion &&
    legalIdentityConfigured() && !!siteKey && !!hostname &&
    !!process.env.MKT9_TURNSTILE_SECRET?.trim() &&
    !!process.env.MKT9_COMMUNITY_SUPABASE_SECRET?.trim() &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  return { enabled, siteKey: enabled ? siteKey! : "", hostname: enabled ? hostname! : "" };
}
export function communityPath(locale: "it" | "en", kind: "partner" | "investor") {
  return (locale === "en" ? "/en/project/interest" : "/progetto/interesse") + "?kind=" + kind;
}
