import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = path => readFileSync(join(root, path), "utf8");

test("Purchasing has one clear RFQ-and-chat entry, on the canonical hub route", () => {
  const nav = source("lib/commercial-director-navigation.ts");
  assert.match(nav, /label: "Ufficio acquisti"/);
  assert.match(nav, /label: "RFQ e conversazioni", href: appRoutes\.rfqHub\.home/);
  assert.doesNotMatch(nav, /label: "Centro RFQ"/);
});

test("The hub exposes existing campaigns as conversations without bypassing RLS", () => {
  const hub = source("app/(italian)/(workspace)/marketplace/rfq-hub/page.tsx");
  assert.match(hub, /data-testid="rfq-hub-quick-conversation"/);
  assert.match(hub, /["']?Apri chat["']?/);
  assert.match(hub, /href=\{appRoutes\.rfqHub\.campaign\(campaign\.id\)\}/);
  assert.match(hub, /\.eq\("organization_id", organizationId\)/);
});

test("RFQ chat prioritizes existing conversations; preparation actions are contextual", () => {
  const chat = source("components/rfqc1-chat-workspace.tsx");
  assert.match(chat, /const preparing = props\.status === "draft" \|\| props\.status === "ready"/);
  assert.match(chat, /<details data-testid="rfqc1-new-request"/);
  assert.match(chat, /\{preparing \? \(\s*<>\s*<details data-testid="rfqc1-supplier-selection"/);
  assert.match(chat, /data-testid="rfqc1-advanced-action"/);
  assert.match(chat, /href="#rfqc1-advanced"/);
  assert.match(chat, /<Rfqc1ChatComposer/);
  assert.match(chat, /hasComparison \? \(<aside id="rfqc1-comparison"/);
  assert.match(chat, /disabled=\{!props\.canExecute/);
});
