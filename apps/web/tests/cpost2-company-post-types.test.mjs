import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const model = read("../lib/company-posts-model.ts");
const actions = read("../app/(italian)/(workspace)/dashboard/company-post-actions.ts");
const card = read("../components/company-post.tsx");
const feed = read("../components/home-feed.tsx");
const migration = read("../../../supabase/migrations/20261104170000_cpost2_company_post_types.sql");
const gate = read("../../../.github/workflows/p0-required-gate.yml");

const compiled = ts.transpileModule(model, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox);
const m = sandbox.exports;

const ID = "6f1d1f0e-0b7a-4d38-9d3e-3f2a0c1b2d4e";
const CO = "0c7a4c2e-6a55-4a9f-8f0b-6a3f3d2b1c0a";
const row = (extra = {}) => ({
  id: ID, post_type: "capacity", body: "", details: { process: "taglio", available_to: "2026-11-20", quantity: "200 t/mese" },
  network_company_id: CO, company_name: "Tubi Test S.r.l.", created_at: "2026-11-04T16:05:42.23818+00:00",
  expires_at: "2026-11-20T23:00:00+00:00", edited_at: null, company_verified: true, is_own_company: false,
  is_mine: false, reported_by_me: false, ...extra,
});

test("CPOST2 types: capacity first, then stock, news, event", () => {
  assert.deepEqual(Array.from(m.COMPANY_POST_TYPES, (t) => t.value), ["capacity", "stock", "news", "event"]);
  assert.equal(m.companyPostTypeLabel("capacity"), "Capacità disponibile");
  assert.equal(m.isCompanyPostType("cerco"), false, "no 'cerco materiale': requests go through the RFQ page");
  for (const type of ["capacity", "stock", "news", "event"]) assert.match(migration, new RegExp("'" + type + "'"));
  assert.match(migration, /check \(post_type in \('capacity','stock','news','event'\)\)/);
});

test("CPOST2 parses typed posts; legacy posts are news; incomplete typed posts are dropped", () => {
  const post = m.parseCompanyPost(row());
  assert.equal(post.postType, "capacity");
  assert.equal(post.body, "", "typed posts may have no text");
  assert.equal(post.expiresAt, "2026-11-20T23:00:00+00:00");
  assert.equal(m.parseCompanyPost(row({ post_type: undefined, body: "Ciao", details: undefined })).postType, "news");
  assert.equal(m.parseCompanyPost(row({ post_type: "news", body: "" })), null, "news needs text");
  assert.equal(m.parseCompanyPost(row({ details: {} })), null, "capacity needs its process");
  assert.equal(m.parseCompanyPost(row({ post_type: "stock", details: { grade: "P235GH" } })), null, "stock needs the product");
  assert.equal(m.parseCompanyPost(row({ post_type: "boh" })), null);
  const odd = m.parseCompanyPost(row({ details: { process: "taglio", nested: { a: 1 }, "Bad Key": "x", flag: true } }));
  assert.deepEqual(Object.keys(odd.details).sort(), ["flag", "process"], "only flat string/boolean details survive");
});

test("CPOST2 detail rows are readable Italian and dates do not drift", () => {
  assert.equal(m.companyPostDate("2026-11-20"), "20 nov 2026");
  assert.equal(m.companyPostDate("20/11/2026"), null);
  const capacity = m.companyPostDetailRows({ postType: "capacity", details: { process: "laser", available_from: "2026-11-10", available_to: "2026-11-20", location: "Brescia" } });
  assert.deepEqual(Array.from(capacity, (r) => r.label), ["Lavorazione", "Periodo", "Luogo"]);
  assert.equal(capacity[0].value, "Taglio laser");
  assert.equal(capacity[1].value, "10 nov 2026 – 20 nov 2026");
  const other = m.companyPostDetailRows({ postType: "capacity", details: { process: "altro", process_detail: "Calandratura" } });
  assert.equal(other[0].value, "Calandratura");
  const stock = m.companyPostDetailRows({ postType: "stock", details: { product: "Tubo senza saldatura", standard: "EN 10216-2", certificate_31: true } });
  assert.deepEqual(Array.from(stock, (r) => r.value), ["Tubo senza saldatura", "EN 10216-2", "EN 10204 3.1"]);
  const event = m.companyPostDetailRows({ postType: "event", details: { name: "Made in Steel", date_from: "2027-05-12", location: "Milano" } });
  assert.equal(event[1].value, "dal 12 mag 2027");
  assert.deepEqual(Array.from(m.companyPostDetailRows({ postType: "news", details: {} })), []);
});

test("CPOST2 'Chiedi un'offerta' only on other companies' capacity and stock, through the RFQ page", () => {
  const post = m.parseCompanyPost(row());
  assert.equal(m.companyPostOfferHref(post), "/commercial?network=" + CO + "&compose=1#commercial-compose");
  assert.equal(m.companyPostOfferHref({ ...post, isOwnCompany: true }), null);
  assert.equal(m.companyPostOfferHref({ ...post, postType: "news" }), null);
  assert.equal(m.companyPostOfferHref({ ...post, postType: "event" }), null);
  assert.equal(m.companyPostIsOffer("stock"), true);
  assert.match(card, /data-testid="company-post-offer"/);
  assert.doesNotMatch(card, /sendEmail|mailto:|cpost1_send|inquiry/i, "the post never sends a request by itself");
});

test("CPOST2 errors from SQL become Italian guidance", () => {
  assert.equal(m.companyPostErrorCopy("missing post detail: product"), "Indica il prodotto.");
  assert.equal(m.companyPostErrorCopy("invalid capacity process"), "Scegli la lavorazione.");
  assert.match(m.companyPostErrorCopy("capacity period already ended"), /già passata/);
  assert.match(m.companyPostErrorCopy("event ends before it starts"), /precedente/);
});

test("CPOST2 server actions whitelist details per type and SQL re-validates", () => {
  assert.match(actions, /rpc\("cpost2_create_post", \{\s*p_organization_id: context\.organizationId,\s*p_post_type: postType,/);
  assert.match(actions, /p_details: cleanDetails\(postType, details\)/);
  assert.match(actions, /if \(!isCompanyPostType\(postType\)\)/);
  assert.match(actions, /capacity: \["process", "process_detail", "available_from", "available_to", "quantity", "location"\]/);
  assert.match(actions, /rpc\("cpost2_feed", \{[\s\S]*?p_post_type: postType/);
  assert.match(migration, /private\.cpost2_normalize_details\(p_post_type, p_details\)/);
  assert.match(migration, /revoke all on function private\.cpost2_normalize_details\(text, jsonb\) from public, anon, authenticated;/);
});

test("CPOST2 expiry: capacity and stock 30 days, events after they end, the feed hides expired posts", () => {
  assert.match(migration, /when 'stock' then p_created_at \+ interval '30 days'/);
  assert.match(migration, /when 'capacity' then least\(\s*p_created_at \+ interval '30 days'/);
  assert.match(migration, /and \(p\.expires_at is null or p\.expires_at > now\(\)\)/);
  assert.match(card, /Disponibile fino al/);
});

test("CPOST2 composer starts on capacity; feed filter shows only one type", () => {
  assert.match(card, /useState<CompanyPostType>\("capacity"\)/);
  assert.match(card, /role="radiogroup" aria-label="Tipo di post"/);
  assert.match(card, /role="radiogroup" aria-label="Filtra il feed"/);
  assert.match(feed, /\{postFilter \? <CompanyPostsOfType type=\{postFilter\} isAdmin=\{isAdmin\} \/> : null\}/);
  assert.match(feed, /hidden=\{postFilter !== null\}/);
  assert.match(gate, /cpost2_company_post_types\.sql/);
});

test("CPOST3 compact composer: one line when closed, dense fields when open, draft kept on close", () => {
  // Founder request, 5 Nov 2026: a more compact, nicer post box.
  assert.match(card, /const \[open, setOpen\] = useState\(false\);/, "starts closed");
  assert.match(card, /data-state="collapsed"/);
  assert.match(card, /data-testid="company-post-open"/);
  assert.match(card, /data-testid=\{"company-post-start-" \+ option\.value\}/, "four type shortcuts when closed");
  assert.match(card, /Riprendi la bozza del post/, "closing keeps the draft");
  assert.match(card, /function close\(\) \{\s*setOpen\(false\);/);
  assert.doesNotMatch(card.slice(card.indexOf("function close()"), card.indexOf("function choose(")), /setDraft|setValue/, "close never discards the draft");
  assert.match(card, /＋ Aggiungi una nota/, "notes are opt-in for typed posts");
  assert.match(card, /const compactField =\s*"h-9 /, "fields are 36px high");
  assert.match(card, /grid grid-cols-2 gap-x-2\.5 gap-y-2 sm:grid-cols-6/);
  assert.match(card, /event\.key === "Escape" && !\(event\.target instanceof HTMLSelectElement\)/);
  assert.match(card, /aria-label="Chiudi senza pubblicare \(la bozza resta\)"/);
  assert.match(card, /setOpen\(false\);\s*onPublished\(result\.item\);/, "publishing closes the box");
});
