import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const actions = fs.readFileSync(path.join(root, "app/(workspace)/assistant/p1-actions.ts"), "utf8");
const component = fs.readFileSync(path.join(root, "components/grounded-assistant.tsx"), "utf8");
const page = fs.readFileSync(path.join(root, "app/(workspace)/assistant/page.tsx"), "utf8");

test("P1 assistant derives actor from verified server session and uses the tenant-safe endpoint", () => {
  assert.match(actions, /supabase\.auth\.getUser\(\)/);
  assert.match(actions, /actor_user_id: actorUserId/);
  assert.match(actions, /\/v1\/assistant/);
  assert.doesNotMatch(actions, /owner_id: ownerId/);
  assert.match(actions, /WORKER_INTERNAL_TOKEN/);
});

test("P1 assistant exposes inline citations and a dedicated evidence drawer", () => {
  assert.match(component, /Evidence drawer/);
  assert.match(component, /\[S#\]/);
  assert.match(component, /Apri evidence/);
  assert.match(component, /Apri thread originale/);
  assert.match(component, /insufficient_evidence/);
});

test("assistant page renders the grounded P1 experience", () => {
  assert.match(page, /GroundedAssistant/);
  assert.match(page, /storico commerciale/i);
});


test("assistant is positioned as secondary support for core sales workflows", () => {
  assert.match(page, /Supporto commerciale/);
  assert.match(page, /Assistente/);
  assert.match(page, /href="\/search"/);
  assert.match(page, /href="\/products"/);
  assert.match(page, /Cerca nello storico/);
  assert.match(page, /Apri storico prodotti/);
  assert.match(component, /Assistente con fonti/);
  assert.match(component, /Usa l’assistente per approfondire lo storico/);
  assert.match(component, /Accesso verificato/);
  assert.doesNotMatch(page + component, /AI Assistant/);
  assert.doesNotMatch(page + component, /Tenant verified/);
  assert.doesNotMatch(page + component, /service role/);
  assert.doesNotMatch(page + component, /Evidence-first assistant/);
});
