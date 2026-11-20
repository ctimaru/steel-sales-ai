import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const request = read("../app/(italian)/(workspace)/rfq-hub/distinta/page.tsx");
const action = read("../app/(italian)/(workspace)/rfq-hub/distinta/reuse-actions.ts");
const loader = read("../lib/network-rdo-saved-distintas.ts");
const picker = read("../components/network-rdo-distinta-picker.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const pro = read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const free = read("../components/free-network-profile.tsx");
const previous = read("../app/(italian)/(public)/distinta/actions.ts");

test("NET-DISTINTA-REUSE1: company CTA reuses the existing single Distinta entry", () => {
  assert.match(pro, /newRequestHref\(\{network: profile\.company\.id\}\)/);
  assert.match(free, /newRequestHref\(\{network: companyId\}\)/);
  assert.match(request, /getCommercialNetworkContext\(context\.organizationId, params\.network\)/);
  assert.match(request, /params\.nuova !== "1"/);
  assert.match(request, /savedChoice\?\.items\.length/);
  assert.match(request, /<NetworkRdoDistintaPicker/);
  assert.match(request, /newRequestHref\(\{ network: networkContext\.id \}\) \+ "&nuova=1"/);
  assert.match(request, /<BuyerDistintaBuilder/);
  assert.match(request, /stepTwoNetworkCompanyId=\{networkContext\?\.id \?\? null\}/);
});

test("NET-DISTINTA-REUSE1: no leak of private or already dispatched Distinte", () => {
  assert.match(loader, /import "server-only"/);
  assert.match(loader, /\.eq\("organization_id", organizationId\)/);
  assert.match(loader, /\.eq\("owner_user_id", userId\)/);
  assert.match(loader, /\.is\("archived_at", null\)/);
  assert.match(loader, /\.gt\("line_count", 0\)/);
  assert.match(loader, /\.select\("id,source_distinta_id,status"\)/);
  assert.match(loader, /\.in\("source_distinta_id", ids\)/);
  assert.match(loader, /statuses\.every\(\(status\) => PREPARATION\.has\(status\)\)/);
  assert.match(loader, /if \(campaignError\) return \{ items: \[\], error: true \}/);
});

test("NET-DISTINTA-REUSE1: selection server action enforces authorization and never dispatches", () => {
  assert.match(action, /"use server"/);
  assert.match(action, /UUID\.test\(input\.distintaId\)/);
  assert.match(action, /UUID\.test\(input\.networkCompanyId\)/);
  assert.match(action, /requireWorkspaceWriteRole\(appRoutes\.rfqHub\.home\)/);
  assert.match(action, /getCommercialNetworkContext\(context\.organizationId, input\.networkCompanyId\)/);
  assert.match(action, /\.eq\("organization_id", context\.organizationId\)/);
  assert.match(action, /\.eq\("owner_user_id", context\.userId\)/);
  assert.match(action, /\.is\("archived_at", null\)/);
  assert.match(action, /\.gt\("line_count", 0\)/);
  assert.match(action, /PREPARATION\.has\(campaign\.status\)/);
  assert.match(action, /createBuyerRfqCampaign\(distinta\.id\)/);
  assert.match(previous, /\.eq\("owner_user_id", authData\.user\.id\)/);
  assert.match(action, /"\?dal=" \+ encodeURIComponent\(company\.id\)/);
  assert.doesNotMatch(action, /sendBuyerDistinta|dispatchBuyerRfq|send.*email/i);
});

test("NET-DISTINTA-REUSE1: modern compact searchable picker, explicit new/reuse paths", () => {
  assert.match(picker, /data-testid="network-rdo-distinta-picker"/);
  assert.match(picker, /data-testid="network-rdo-distinta-options"/);
  assert.match(picker, /data-testid="network-rdo-new-distinta"/);
  assert.match(picker, /data-testid="network-rdo-use-distinta"/);
  assert.match(picker, /aria-label=\{"Usa Distinta: " \+ item\.title\}/);
  assert.match(picker, /items\.length > 5/);
  assert.match(picker, /prepareSavedNetworkRdo\(\{ distintaId: id, networkCompanyId \}\)/);
  assert.match(picker, /router\.push\(outcome\.href\)/);
  assert.match(picker, /disabled=\{pending\}/);
  assert.match(picker, /nessuna email viene inviata prima della tua conferma/i);
  assert.match(builder, /stepTwoNetworkCompanyId \? "\?dal=" \+ encodeURIComponent\(stepTwoNetworkCompanyId\)/);
});
