import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const evidence=read("../lib/network-profile-evidence.ts");
const free=read("../components/free-network-profile.tsx");
const pro=read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const overview=read("../components/network-profile-overview.tsx");
const qa=read("../app/(italian)/(workspace)/network-visual-qa/page.tsx");
const chrome=read("./netro14d-chrome-claimable-visual.mjs");

test("NET-PROFILE-DATA1: only accepted evidence RPC supplies source-backed Free and Pro facts",()=>{
  assert.match(evidence,/netprofile1d_profile_evidence/);
  assert.match(evidence,/data\.contract!=="netprofile1d-evidence-v1"/);
  assert.match(evidence,/summarizeReviewedCompanyEvidence/);
  assert.match(evidence,/\["description","products","services"\]/);
  assert.match(evidence,/item\.evidence_url/);
  assert.match(evidence,/Array\.isArray\(item\.field_value\)/);
  assert.match(evidence,/seenProducts/);
  assert.match(evidence,/list\.length>=8/);
  assert.doesNotMatch(evidence,/network_company_enrichment|service_role|candidate/);
  for(const profile of [free,pro]){
    assert.match(profile,/getReviewedCompanyEvidence/);
    assert.match(profile,/summarizeReviewedCompanyEvidence/);
    assert.match(profile,/safeNetworkWebsiteUrl\(reviewedSummary\.evidenceSourceUrl\)/);
    assert.match(profile,/description=\{profile\.company\.description \|\| reviewedSummary\.description\}/);
  }
  assert.match(pro,/getReviewedCompanyEvidence\(context\.organizationId,profile\.company\.id,"pro"\)/);
  assert.match(overview,/data-testid="network-company-source-attribution"/);
  assert.match(overview,/Informazioni da fonte pubblica, non disponibilità a magazzino/);
  assert.match(overview,/rel="noopener noreferrer"/);
  assert.match(qa,/evidenceSourceUrl="https:\/\/example\.org\/company\/facts"/);
  assert.match(chrome,/getByTestId\("network-company-source-attribution"\)/);
});
