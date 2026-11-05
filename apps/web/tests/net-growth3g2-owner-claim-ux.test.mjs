import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const claimCta=readFileSync(new URL("../components/network-activation-cta.tsx",import.meta.url),"utf8");
const profile=readFileSync(new URL("../components/free-network-profile.tsx",import.meta.url),"utf8");
const source=JSON.parse(readFileSync(new URL("../../../services/worker/data/netgrowth3g2_traders_20261105.json",import.meta.url),"utf8"));

test("NET-GROWTH3.G.2: 50 unique source-led trader profiles, none verified",()=>{
 assert.equal(source.records.length,50);
 assert.equal(new Set(source.records.map(r=>r.domain)).size,50);
 assert.ok(source.records.every(r=>r.proposed_role==="trader_distributor"&&r.intake_status==="needs_review"));
 assert.ok(source.records.every(r=>r.source_url.startsWith("https://")&&new URL(r.source_url).hostname.replace(/^www\./,"")===r.domain));
 assert.equal(source.database_after.directory_backing,836);
 assert.equal(source.database_after.canonical_published,278);
 assert.equal(source.trust.stock_or_price_verified,false);
 assert.equal(source.trust.public_canonical_published,false);
});

test("NET-GROWTH3.G.2: one owner CTA above connection, no extra accordion",()=>{
 assert.match(profile,/data-testid="network-owner-claim-journey"/);
 assert.ok(profile.indexOf("network-owner-claim-journey")<profile.indexOf('aria-label="Connessione aziendale"'));
 assert.match(profile,/Rivendica azienda/);
 assert.match(profile,/Arricchisci profilo/);
 assert.match(profile,/Verifica informazioni/);
 assert.doesNotMatch(profile,/Rappresenti questa azienda\?/);
});

test("NET-GROWTH3.G.2: provisional registration cannot auto claim or verify a supplier",()=>{
 assert.match(claimCta,/if\(mode==="published"\) return "\/network\/"\+encodeURIComponent\(companyId\)\+"\/claim"/);
 assert.match(claimCta,/return "\/register"\+/);
 assert.match(claimCta,/NOT passed as a claim_ref/);
 assert.match(claimCta,/nessuna assegnazione è automatica/);
 assert.match(claimCta,/Rivendica azienda/);
 assert.match(claimCta,/Rivendica il profilo/);
});
