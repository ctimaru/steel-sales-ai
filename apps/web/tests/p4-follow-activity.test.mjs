import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const following = fs.readFileSync(
  new URL("../app/(workspace)/network/following/page.tsx", import.meta.url),
  "utf8",
);
const activity = fs.readFileSync(
  new URL("../app/(workspace)/network/activity/page.tsx", import.meta.url),
  "utf8",
);
const directory = fs.readFileSync(
  new URL("../app/(workspace)/network/page.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);
const networkLib = fs.readFileSync(
  new URL("../lib/network.ts", import.meta.url),
  "utf8",
);

test("NET-CONNECT1 leaves legacy private follow actions stored, but removes social profile CTA", () => {
  assert.doesNotMatch(profile, /Segui aggiornamenti|Non seguire più|Salva azienda/);
  assert.match(profile, />\n\s*Connetti\n\s*<\/Link>/); // NET-UX LOT1: CTA renamed
  assert.match(actions, /p4_follow_company/);
  assert.match(actions, /p4_unfollow_company/);
});

// NET-UX LOT1 (founder decision 2 Nov 2026): following and its activity feed are
// retired from the interface; stored data and RPCs stay, the pages redirect.
test("NET-UX LOT1 retires followed companies and the activity feed without dropping data", () => {
  for (const page of [following, activity]) {
    assert.match(page, /redirect\("\/network"\)/);
    assert.doesNotMatch(page, /p4_follow_company|p4_list_activity_feed|Segui/);
  }
  assert.match(actions, /p4_follow_company/);
  assert.match(actions, /p4_unfollow_company/);
  assert.match(networkLib, /p4_list_activity_feed/);
});

test("NET-CONNECT1 keeps legacy history while removing social entry points", () => {
  assert.match(shell, /href: appRoutes\.network\.connections/);
  assert.doesNotMatch(shell, /href: appRoutes\.network\.activity|href: appRoutes\.network\.following/);
  assert.doesNotMatch(directory, /followNetworkCompany|unfollowNetworkCompany|Seguite · /);
  assert.match(directory, /Connessioni aziendali/);
});
