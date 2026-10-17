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
  assert.match(profile, /Richiedi connessione/);
  assert.match(actions, /p4_follow_company/);
  assert.match(actions, /p4_unfollow_company/);
});

test("P4.7 followed-company UX is explicitly private and non-social", () => {
  assert.match(following, /Il follow è privato/);
  assert.match(following, /Non crea connection, endorsement o follower count pubblico/);
  assert.match(following, /Aziende seguite/);
  assert.match(actions, /p4_follow_company/);
  assert.match(actions, /p4_unfollow_company/);
});

test("P4.7 activity feed exposes only Network activity semantics and read controls", () => {
  assert.match(activity, /Aggiornamenti aziende seguite/);
  assert.match(activity, /Commercial Memory non compaiono qui/);
  assert.match(activity, /Solo non lette/);
  assert.match(activity, /Segna tutte lette/);
  assert.match(actions, /p4_mark_activity_read/);
  assert.match(actions, /p4_mark_all_activity_read/);
  assert.match(networkLib, /p4_list_activity_feed/);
});

test("NET-CONNECT1 keeps legacy history while removing social entry points", () => {
  assert.match(shell, /href: appRoutes\.network\.connections/);
  assert.doesNotMatch(shell, /href: appRoutes\.network\.activity|href: appRoutes\.network\.following/);
  assert.doesNotMatch(directory, /followNetworkCompany|unfollowNetworkCompany|Seguite · /);
  assert.match(directory, /Connessioni aziendali/);
});
