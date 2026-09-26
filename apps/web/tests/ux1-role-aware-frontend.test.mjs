import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const workspaceLayout = fs.readFileSync(new URL("../app/(workspace)/layout.tsx", import.meta.url), "utf8");
const companyShell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const companyHome = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const platformLayout = fs.readFileSync(new URL("../app/(platform)/platform/layout.tsx", import.meta.url), "utf8");
const platformShell = fs.readFileSync(new URL("../components/platform-shell.tsx", import.meta.url), "utf8");
const platformHome = fs.readFileSync(new URL("../app/(platform)/platform/page.tsx", import.meta.url), "utf8");
const legacyAdmin = fs.readFileSync(new URL("../app/(workspace)/admin/registrations/page.tsx", import.meta.url), "utf8");

test("UX1 separates public, company and platform entry points", () => {
  assert.match(root, /Registra la tua azienda/);
  assert.match(root, /if \(data\.user\) redirect\("\/dashboard"\)/);
  assert.match(workspaceLayout, /getWorkspaceContext/);
  assert.match(platformLayout, /requirePlatformContext/);
  assert.doesNotMatch(platformLayout, /getWorkspaceContext/);
});

test("UX1 Company Workspace exposes explicit product domains and role context", () => {
  assert.match(companyShell, /Company Workspace/);
  assert.match(companyShell, /Commercial Memory/);
  assert.match(companyShell, /Steel Network/);
  assert.match(companyShell, /Operations/);
  assert.match(companyShell, /Company/);
  assert.match(companyShell, /organizationRole/);
  assert.match(companyShell, /Apri Platform Console/);
  assert.match(companyShell, /adminOnly/);
  assert.match(companyShell, /writeRole/);
});

test("UX1 Company Home combines private Commercial Memory and shared Network context", () => {
  assert.match(companyHome, /Commercial Memory privata \+ Steel Network condiviso/);
  assert.match(companyHome, /Il tuo Network/);
  assert.match(companyHome, /Inquiry B2B/);
  assert.match(companyHome, /Memoria commerciale privata/);
  assert.match(companyHome, /getWorkspaceContext/);
});

test("UX1 Platform Console is structurally separate from tenant workspace", () => {
  assert.match(platformShell, /Global control plane/);
  assert.match(platformShell, /Apri Company Workspace/);
  assert.match(platformShell, /Non apre automaticamente la Commercial Memory privata dei tenant/);
  assert.match(platformHome, /Governance della piattaforma/);
  assert.match(platformHome, /Registrazioni aziende/);
  assert.doesNotMatch(platformShell, /Storico prodotti/);
  assert.doesNotMatch(platformShell, /Importa documenti/);
});

test("UX1 legacy admin entry redirects to Platform Console", () => {
  assert.match(legacyAdmin, /redirect\("\/platform\/registrations"\)/);
});
