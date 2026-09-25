import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const flag = fs.readFileSync(
  new URL("../lib/network-flags.ts", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);
const directory = fs.readFileSync(
  new URL("../app/(workspace)/network/page.tsx", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const managed = fs.readFileSync(
  new URL("../app/(workspace)/network/manage/page.tsx", import.meta.url),
  "utf8",
);
const adminRegistration = fs.readFileSync(
  new URL("../app/(workspace)/admin/registrations/[id]/page.tsx", import.meta.url),
  "utf8",
);

test("M8 rollback flag defaults enabled and has an explicit false kill switch", () => {
  assert.match(flag, /NETWORK_FRONTEND_ENABLED/);
  assert.match(flag, /!== "false"/);
});

test("M8 rollback flag removes Network navigation and disables all Network routes", () => {
  assert.match(shell, /networkEnabled/);
  assert.match(shell, /item\.href !== "\/network"/);

  for (const source of [directory, profile, managed]) {
    assert.match(source, /isNetworkFrontendEnabled/);
    assert.match(source, /redirect\("\/dashboard"\)/);
  }
});

test("M8 rollback flag disables the Superadmin registration bridge UI", () => {
  assert.match(adminRegistration, /isNetworkFrontendEnabled/);
  assert.match(adminRegistration, /networkEnabled && application\.application_status === "activated"/);
});
