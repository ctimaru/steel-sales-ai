import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const profile = read("../components/network-profile-overview.tsx");
const launcher = read("../components/network-rdo-modal-launcher.tsx");
const actions = read("../app/(italian)/(workspace)/rfq-hub/distinta/reuse-actions.ts");
const picker = read("../components/network-rdo-distinta-picker.tsx");
const free = read("../components/free-network-profile.tsx");
const pro = read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const chrome = read("./netro14d-chrome-claimable-visual.mjs");

test("NET-RDO-INLINE2: company CTA is a high-contrast BUTTON, not a route link", () => {
  assert.match(profile, /<NetworkRdoModalLauncher companyId=\{requestNetworkCompanyId\} companyName=\{name\}/);
  assert.match(profile, /requestHref && requestNetworkCompanyId/);
  assert.match(free, /requestNetworkCompanyId=\{!provisional && canWriteWorkspace\(workspace\.role\)/);
  assert.match(pro, /requestNetworkCompanyId=\{organizationId && canWriteWorkspace\(membershipRole\)/);
  assert.match(launcher, /<button type="button" onClick=\{showModal\}/);
  assert.match(launcher, /data-testid="network-profile-request-rdo"/);
  assert.match(launcher, /aria-haspopup="dialog"/);
  assert.match(launcher, /!bg-\[#174f37\] !text-white/);
  assert.match(launcher, /hover:!bg-\[#0e3c29\] hover:!text-white/);
  assert.doesNotMatch(profile, /<Link href=\{requestHref\} data-testid="network-profile-request-rdo"/);
  assert.match(chrome, /buttonContrast>=4\.5/);
});

test("NET-RDO-INLINE2: opening keeps URL and profile in place with native dialog accessibility", () => {
  assert.match(launcher, /dialog\.current\?\.showModal\(\)/);
  assert.match(launcher, /aria-labelledby=\{dialogTitleId\}/);
  assert.match(launcher, /aria-label="Chiudi la Distinta"/);
  assert.match(launcher, /onClose=\{\(\) => setOpened\(false\)\}/);
  assert.match(launcher, /document\.body\.style\.overflow = "hidden"/);
  assert.match(launcher, /loadNetworkRdoModalContext\(companyId\)/);
  assert.match(chrome, /Opening RDO must not navigate or reload the company profile/);
});

test("NET-RDO-INLINE2: saved Distinte and new AI-first Distinta share the same modal", () => {
  assert.match(launcher, /data-testid="network-rdo-modal"/);
  assert.match(launcher, /data-testid="network-rdo-tab-saved"/);
  assert.match(launcher, /data-testid="network-rdo-tab-new"/);
  assert.match(launcher, /<NetworkRdoDistintaPicker/);
  assert.match(launcher, /embedded/);
  assert.match(launcher, /onCreateNew=\{switchToNew\}/);
  assert.match(launcher, /onPrepared=\{continueRdo\}/);
  assert.match(launcher, /<BuyerDistintaBuilder/);
  assert.match(launcher, /authenticated workspace focusAiIntake/);
  assert.match(launcher, /stepTwoNetworkCompanyId=\{context\.companyId\}/);
  assert.match(launcher, /const BuyerDistintaBuilder = dynamic/);
  assert.match(launcher, /\{ ssr: false,/);
  assert.match(launcher, /catalog !== null \? \(/);
  assert.match(picker, /embedded && onCreateNew/);
  assert.match(picker, /if \(onPrepared\) onPrepared\(outcome\.href\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
  assert.doesNotMatch(launcher, /dispatchBuyerRfq|sendBuyerDistinta|sendEmail|window\.location\.href/);
});

test("NET-RDO-INLINE2: no unauthenticated private data; no network/catalog loads on company render", () => {
  assert.match(actions, /export async function loadNetworkRdoModalContext/);
  assert.match(actions, /export async function loadNetworkRdoModalCatalog/);
  assert.match(actions, /UUID\.test\(networkCompanyId\)/);
  assert.match(actions, /requireWorkspaceWriteRole\(appRoutes\.rfqHub\.home\)/);
  assert.match(actions, /getCommercialNetworkContext\(context\.organizationId, networkCompanyId\)/);
  assert.match(actions, /listNetworkRdoSavedDistintas\(context\.organizationId, context\.userId\)/);
  assert.match(actions, /cachedModalCatalog = unstable_cache/);
  assert.match(actions, /distinta-quick1-public-catalog-v1/);
  assert.match(launcher, /if \(!context\) void fetchContext\(\)/);
  assert.match(launcher, /if \(catalog === null\) void fetchCatalog\(\)/);
  assert.match(launcher, /dialog\.current\?\.close\(\)/);
  assert.match(launcher, /router\.push\(href\)/);
});
