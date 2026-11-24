import "server-only";
import { legalIdentityConfigured } from "@/lib/legal";
import { communityWriterConfigured } from "@/lib/community-intake-db";
// The provider's published dummy keys are never accepted by the real acquisition gate.
const dummyTurnstileKey = (key: string) => /^[123]x0+\w{2}$/i.test(key);
export const communityNoticeVersion = "mkt9c-draft-2026-11-24";
export function communityIntakeConfig() {
  const siteKey = process.env.MKT9_TURNSTILE_SITE_KEY?.trim();
  const hostname = process.env.MKT9_TURNSTILE_HOSTNAME?.trim().toLowerCase();
  const secret = process.env.MKT9_TURNSTILE_SECRET?.trim();
  const realTurnstile = !!siteKey && !!secret && !dummyTurnstileKey(siteKey) && !dummyTurnstileKey(secret);
  const officialHost = hostname === "www.smartsteelsales.com";
  const enabled = process.env.MKT9_COMMUNITY_INTAKE_ENABLED === "true" &&
    !communityNoticeVersion.includes("-draft-") &&
    process.env.MKT9_COMMUNITY_MAILBOX_VERIFIED === communityNoticeVersion &&
    process.env.MKT9_COMMUNITY_CREDENTIAL_APPROVED === communityNoticeVersion &&
    !!process.env.MKT9_COMMUNITY_EMAIL_FROM?.trim() && !!process.env.RESEND_API_KEY?.trim() &&
    (process.env.MKT9_COMMUNITY_OTP_SECRET?.length ?? 0) >= 32 &&
    process.env.MKT9_COMMUNITY_NOTICE_APPROVED === communityNoticeVersion &&
    process.env.MKT9_COMMUNITY_RETENTION_APPROVED === communityNoticeVersion &&
    process.env.MKT9_COMMUNITY_PURGE_VERIFIED === communityNoticeVersion &&
    legalIdentityConfigured() && realTurnstile && officialHost &&
    communityWriterConfigured();
  return { enabled, siteKey: enabled ? siteKey! : "", hostname: enabled ? hostname! : "" };
}
export function communityPath(locale: "it" | "en", kind: "partner" | "investor") {
  return (locale === "en" ? "/en/project/interest" : "/progetto/interesse") + "?kind=" + kind;
}
