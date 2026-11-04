import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const model = read("../lib/company-posts-model.ts");
const feedModel = read("../lib/home-feed-model.ts");
const loader = read("../lib/home-feed.ts");
const posts = read("../lib/company-posts.ts");
const actions = read("../app/(italian)/(workspace)/dashboard/company-post-actions.ts");
const card = read("../components/company-post.tsx");
const feed = read("../components/home-feed.tsx");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const consolePage = read("../app/(italian)/(platform)/platform/network-trust/posts/page.tsx");
const consoleActions = read("../app/(italian)/(platform)/platform/network-trust/posts/actions.ts");
const trustPage = read("../app/(italian)/(platform)/platform/network-trust/page.tsx");
const contract = read("../lib/platform-access-contract.ts");
const ia = read("../lib/platform-ia-contract.ts");
const migration = read("../../../supabase/migrations/20261104150000_cpost1_company_posts.sql");
const migrationB = read("../../../supabase/migrations/20261104160000_cpost1b_staff_settings_read.sql");

function load(source) {
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandbox = { exports: {}, module: { exports: {} } };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox);
  return sandbox.exports;
}
const m = load(model);
const f = load(feedModel);

const ID = "6f1d1f0e-0b7a-4d38-9d3e-3f2a0c1b2d4e";
const CO = "0c7a4c2e-6a55-4a9f-8f0b-6a3f3d2b1c0a";
const row = (extra = {}) => ({
  id: ID, body: "Nuovo lotto di tubi EN 10216-2 disponibile", network_company_id: CO,
  company_name: "Acciai Test S.r.l.", created_at: "2026-11-04T14:05:42.23818+00:00",
  edited_at: null, company_verified: true, is_own_company: false, is_mine: false, reported_by_me: false, ...extra,
});

test("CPOST1 parses only posts of verified companies from the feed contract", () => {
  const post = m.parseCompanyPost(row());
  assert.equal(post.kind, "post");
  assert.equal(post.key, "post:" + ID);
  assert.equal(post.companyName, "Acciai Test S.r.l.");
  assert.equal(m.parseCompanyPost(row({ company_verified: false })), null, "unverified company never shown");
  assert.equal(m.parseCompanyPost(row({ id: "nope" })), null);
  assert.equal(m.parseCompanyPost(row({ body: "   " })), null);
  assert.equal(m.parseCompanyPost(row({ created_at: "ieri" })), null);
  assert.equal("author" in post || "authorUserId" in post, false, "the card never carries the author");
  const page = m.parseCompanyPostsFeed({ items: [row(), { bad: true }], next_cursor: { before_created_at: row().created_at, before_id: ID } });
  assert.equal(page.items.length, 1);
  assert.equal(page.next.beforeId, ID);
  assert.equal(m.parseCompanyPostsFeed({ items: [], next_cursor: null }).next, null);
  assert.equal(m.parseCompanyPostsFeed(null), null);
});

test("CPOST1 posts cursor survives the dotted feed cursor and rejects tampering", () => {
  const token = m.encodeCompanyPostsToken({ beforeCreatedAt: "2026-11-04T14:05:42.23818+00:00", beforeId: ID });
  assert.doesNotMatch(token, /\./, "no dot: the feed cursor is dot-separated");
  assert.deepEqual({ ...m.decodeCompanyPostsToken(token) }, { beforeCreatedAt: "2026-11-04T14:05:42.23818+00:00", beforeId: ID });
  assert.equal(m.encodeCompanyPostsToken(null), "x");
  assert.equal(m.decodeCompanyPostsToken("x"), "done");
  assert.equal(m.decodeCompanyPostsToken(""), "start");
  for (const bad of ["drop table~" + ID, "2026-11-04T14:05:42Z~nope", "a".repeat(500), 42]) {
    assert.equal(m.decodeCompanyPostsToken(bad), "start", String(bad));
  }
  const cursor = { ...f.initialHomeFeedCursor, pc: token };
  assert.equal(f.decodeHomeFeedCursor(f.encodeHomeFeedCursor(cursor)).pc, token);
});

test("CPOST1 spaces posts through a feed page", () => {
  const items = (kind, n) => Array.from({ length: n }, (_, i) => ({ kind, key: kind + i }));
  const out = m.withCompanyPosts(items("company", 7), items("post", 3));
  assert.deepEqual(Array.from(out, (x) => x.kind), [
    "post", "company", "company", "company", "post", "company", "company", "company", "post", "company",
  ]);
  assert.deepEqual(Array.from(m.withCompanyPosts([], items("post", 2)), (x) => x.kind), ["post", "post"]);
  assert.equal(m.withCompanyPosts(items("company", 2), []).length, 2);
});

test("CPOST1 composer appears only when SQL allows it; unverified allowed roles get a hint", () => {
  assert.equal(m.companyPostComposerMode(m.parseCompanyPostPublishState({ can_publish: true, reason: null })), "compose");
  assert.equal(m.companyPostComposerMode(m.parseCompanyPostPublishState({ can_publish: false, reason: "company_not_verified" })), "verify_first");
  for (const reason of ["feature_disabled", "role_not_allowed", "not_member", "no_company_profile"]) {
    assert.equal(m.companyPostComposerMode(m.parseCompanyPostPublishState({ can_publish: false, reason })), "hidden", reason);
  }
  assert.equal(m.companyPostComposerMode(null), "hidden");
  assert.equal(m.parseCompanyPostPublishState({ can_publish: false, reason: "bogus" }), null);
});

test("CPOST1 founder numbers and Italian errors", () => {
  assert.equal(m.COMPANY_POST_MAX_CHARS, 3000);
  assert.equal(m.COMPANY_POST_DAILY_LIMIT, 3);
  assert.match(migration, /max_posts_per_org_per_day\s+integer not null default 3/);
  assert.match(migration, /max_body_chars\s+integer not null default 3000/);
  assert.match(m.companyPostErrorCopy("daily post limit reached"), /limite di 3 post al giorno/);
  assert.match(m.companyPostErrorCopy("cannot publish: company_not_verified"), /aziende verificate/);
  assert.match(m.companyPostErrorCopy("something else"), /Riprova/);
  assert.equal(m.isCompanyPostReportReason("spam"), true);
  assert.equal(m.isCompanyPostReportReason("drop"), false);
  for (const reason of ["spam", "inappropriate", "fraud_suspicious", "other"]) assert.match(migration, new RegExp("'" + reason + "'"));
});

test("CPOST1 actions take the organization from the session and never from the browser", () => {
  assert.match(actions, /^"use server";/);
  assert.match(actions, /p_organization_id: context\.organizationId/);
  assert.match(actions, /await getWorkspaceContext\(\)/);
  // CPOST2: publishing and reading go through the typed cpost2_* functions.
  for (const rpc of ["cpost2_create_post", "cpost1_edit_post", "cpost1_delete_post", "cpost1_report_post", "cpost2_feed"]) {
    assert.match(actions, new RegExp('rpc\\("' + rpc + '"'));
  }
  assert.match(actions, /isCompanyPostReportReason\(reason\)/);
  assert.doesNotMatch(actions, /from\("company_posts"\)|organizationId: string/);
  assert.match(posts, /^import "server-only";/);
  assert.match(posts, /rpc\("cpost1_can_publish", \{ p_organization_id: organizationId \}\)/);
});

test("CPOST1 feed reads posts through cpost1_feed and fails soft", () => {
  assert.match(loader, /rpc\("cpost2_feed"/);
  assert.match(loader, /withCompanyPosts\(interleaveHomeFeed\(/);
  assert.match(loader, /if \(posts\.failed\) unavailable\.push\("posts"\)/);
  assert.match(feed, /case "post":\s*return <CompanyPostCard/);
  assert.match(feed, /composer === "compose" \?/);
  assert.match(home, /loadCompanyPostPublishState\(context\.organizationId\)/);
  assert.match(home, /composer=\{postComposer\}/);
});

test("CPOST1 card shows the company only, renders text safely and gates actions", () => {
  assert.match(card, /^"use client";/);
  assert.doesNotMatch(card, /dangerouslySetInnerHTML|createClient|fetch\(/);
  assert.match(card, /whitespace-pre-line/);
  assert.match(card, /const canDelete = item\.isMine \|\| \(item\.isOwnCompany && isAdmin\);/);
  assert.match(card, /const canReport = !item\.isOwnCompany;/);
  assert.match(card, /\{item\.isMine \? \(/);
  assert.match(card, /Azienda verificata/);
  assert.match(card, /role="alertdialog"/);
});

test("CPOST1 console queue rechecks exact capabilities on page and action", () => {
  assert.match(consolePage, /requirePlatformPermission\("network_trust\.posts_read"\)/);
  assert.match(consolePage, /permissions\.includes\("network_trust\.posts_moderate"\)/);
  assert.match(consolePage, /<ConfirmSubmitButton/);
  assert.match(consoleActions, /^"use server";/);
  assert.match(consoleActions, /moderateCompanyPost[\s\S]*?requirePlatformPermission\("network_trust\.posts_moderate"/);
  assert.match(consoleActions, /rpc\("cpost1_staff_moderate_post"/);
  assert.match(consoleActions, /decision === "remove" && !note/);
  assert.match(trustPage, /permissions\.includes\("network_trust\.posts_read"\)/);
  for (const key of ["network_trust.posts_read", "network_trust.posts_moderate"]) {
    assert.match(contract, new RegExp('key: "' + key.replace(".", "\\.") + '"'));
    assert.match(migration, new RegExp("'" + key.replace(".", "\\.") + "'"));
  }
  assert.match(contract, /moderateCompanyPost: "network_trust\.posts_moderate"/);
  assert.match(ia, /\{ path: "\/platform\/network-trust\/posts", module: "networkTrust" \}/);
});

test("CPOST1B console shows the switch state and only the superadmin can change it", () => {
  const settings = m.parseCompanyPostSettings({
    contract: "cpost1-settings-v1", enabled: true, max_body_chars: 3000, max_posts_per_org_per_day: 3,
    auto_hide_report_threshold: 3, updated_at: "2026-11-04T14:44:09.56528+00:00", can_update: false,
    published_posts: 1, hidden_posts: 0, open_reports: 0,
  });
  assert.equal(settings.enabled, true);
  assert.equal(settings.canUpdate, false);
  assert.equal(settings.maxPostsPerDay, 3);
  assert.equal(m.parseCompanyPostSettings({ contract: "other", enabled: true }), null);
  assert.equal(m.parseCompanyPostSettings({ contract: "cpost1-settings-v1" }), null);
  assert.equal(m.parseCompanyPostSettings({ contract: "cpost1-settings-v1", enabled: false, published_posts: -4 }).publishedPosts, 0);

  assert.match(posts, /rpc\("cpost1_staff_settings"\)/);
  assert.match(consolePage, /loadCompanyPostSettings\(\)/);
  assert.match(consolePage, /settings\?\.canUpdate \?/);
  assert.match(consolePage, /data-testid="company-posts-switch"/);
  assert.match(consoleActions, /setCompanyPostsEnabled[\s\S]*?await requirePlatformSuperadmin\(BASE\)/);
  assert.match(consoleActions, /rpc\("cpost1_staff_update_settings", \{ p_enabled: enabled \}\)/);
  assert.match(consoleActions, /value !== "true" && value !== "false"/);

  assert.match(migrationB, /require_platform_permission\('network_trust\.posts_read'\)/);
  assert.match(migrationB, /'can_update',\s+private\.is_platform_superadmin\(\)/);
  assert.match(migrationB, /revoke all on function public\.cpost1_staff_settings\(\) from public, anon;/);
  assert.doesNotMatch(migrationB, /security definer[^;]*\n\$\$ select private/, "public wrapper stays invoker");
  assert.doesNotMatch(migrationB, /updated_by/, "the switch state never exposes who changed it");
  assert.match(migration, /if \(select auth\.uid\(\)\) is null or not private\.is_platform_superadmin\(\)/);
});
