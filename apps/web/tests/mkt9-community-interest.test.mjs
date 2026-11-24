import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const cfg=read("../lib/community-intake-config.ts");
const action=read("../lib/community-intake-actions.ts");
const form=read("../components/community-interest-page.tsx");
const inbox=read("../components/community-interest-inbox.tsx");
const owner=read("../lib/community-interest-owner-actions.ts");
const crm=read("../app/(italian)/(platform)/platform/fundraising/page.tsx");
const sql=read("../../../docs/marketing/mkt9c-community-interest-schema.candidate.sql");
test("MKT9C defaults closed; no client data intake without legal and bot gate",()=>{
 assert.match(cfg,/MKT9_COMMUNITY_INTAKE_ENABLED === "true"/);
 assert.match(cfg,/MKT9_COMMUNITY_NOTICE_APPROVED === communityNoticeVersion/);
 assert.match(cfg,/legalIdentityConfigured\(\)/);
 assert.match(action,/if \(!config.enabled\) redirect/);
 assert.match(action,/siteverify/);
 assert.match(action,/result.hostname === config.hostname/);
 assert.match(action,/result.action === "community_interest"/);
 assert.ok(action.indexOf("if (!verified) redirect")<action.indexOf('.rpc("mkt9_reserve_email"'));
 assert.doesNotMatch(form,/MKT9_COMMUNITY_SUPABASE_SECRET|MKT9_TURNSTILE_SECRET/);
});
test("MKT9C proposed database separates private intake from investment commitments",()=>{
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all .* from public,anon,authenticated,service_role/i);
 assert.match(sql,/unique\(kind,email\)/i);
 assert.match(sql,/challenge_digest text not null unique/i);
 assert.match(sql,/public.is_platform_superadmin\(\)/);
 assert.match(sql,/grant insert\(kind,locale,name,email,organization,notice_version,challenge_digest\).*to service_role/i);
 assert.doesNotMatch(sql,/grant insert.*to (anon|authenticated)/i);
 assert.match(sql,/exception when unique_violation/);
 assert.doesNotMatch(action,/upsert\(|mkt8_investor_outreach_target_upsert|sendEmail|invite_id/);
});
test("MKT9C integrates into owner console without auto granting access",()=>{
 assert.match(inbox,/await requirePlatformSuperadmin\(\)/);
 assert.match(owner,/await requirePlatformSuperadmin\(\)/);
 assert.match(inbox,/Email non verificata/);
 assert.match(inbox,/ConfirmSubmitButton/);
 assert.match(crm,/CommunityInterestInbox/);
 assert.match(crm,/defaultValue=\{communityLead\?\.name/);
 assert.match(crm,/eq\("kind","investor"\).eq\("status","contacted"\)/);
 assert.match(form,/Nessun account, pagamento, prenotazione o offerta di investimento/);
});

test("MKT9C retention and CRM handoff require separate approval",()=>{
 assert.match(cfg,/MKT9_COMMUNITY_RETENTION_APPROVED === communityNoticeVersion/);
 assert.match(cfg,/MKT9_COMMUNITY_PURGE_VERIFIED === communityNoticeVersion/);
 assert.match(inbox,/gt\("expires_at",now\)/);
 assert.match(owner,/gt\("expires_at",new Date\(\).toISOString\(\)\)/);
 assert.match(crm,/MKT9_COMMUNITY_CRM_TRANSFER_APPROVED === "true"/);
 assert.match(crm,/gt\("expires_at",new Date\(\).toISOString\(\)\)/);
 const purge=read("../../../docs/marketing/mkt9c-retention-purge.candidate.sql");
 assert.match(purge,/where expires_at <= now\(\)/);
 assert.match(purge,/limit 1000 for update skip locked/);
 assert.doesNotMatch(purge,/cron\.schedule\(/);
});

test("MKT9C2 email verification is fail closed and limits mail delivery",()=>{
 assert.match(cfg,/!communityNoticeVersion.includes\("-draft-"\)/);
 assert.match(cfg,/MKT9_COMMUNITY_MAILBOX_VERIFIED === communityNoticeVersion/);
 assert.match(action,/randomInt\(0,100000000\)/);
 assert.match(action,/createHmac\("sha256"/);
 assert.match(action,/if\(!error && data===true\)/);
 assert.match(action,/Idempotency-Key/);
 assert.match(action,/mkt9_confirm_email/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/attempts>=5/);
 assert.match(sql,/r.expires_at<=now\(\)/);
 assert.match(sql,/security invoker set search_path=''/i);
 assert.match(sql,/revoke all on function .*from public,anon,authenticated,service_role/i);
 assert.match(form,/autoComplete="one-time-code"/);
 assert.match(form,/mkt9_community_receipt/);
 assert.match(crm,/not\("email_verified_at","is",null\)/);
});
