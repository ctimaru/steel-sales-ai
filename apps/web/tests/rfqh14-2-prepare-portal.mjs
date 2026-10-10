/**
 * RFQH14.2: generate random LOCAL-ONLY supplier invitation tokens.
 * No network calls, external credentials or persistent test accounts.
 */
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";

const temp = process.env.RUNNER_TEMP;
assert.ok(temp && process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:54321", "RFQH14.2 strictly local");
const personas = JSON.parse(readFileSync(path.join(temp, "demotest23-personas.json"), "utf8"));
assert.equal(personas.length, 5, "Requires DEMOTEST2.3 GoTrue identities");

const portal = {};
const sqlVars = [];
for (const name of ["producer", "trader"]) {
  const token = randomBytes(32).toString("hex");
  portal[name] = { token };
  sqlVars.push("\\set rfqh14_" + name + "_hash '" +
    createHash("sha256").update(token).digest("hex") + "'");
}
for (const [filename, data] of [
  ["rfqh14-2-tokens.json", JSON.stringify(portal)],
  ["rfqh14-2-psql-vars.sql", sqlVars.join("\n") + "\n"],
]) {
  const dest = path.join(temp, filename);
  writeFileSync(dest, data, { mode: 0o600 });
  chmodSync(dest, 0o600);
}
console.log("RFQH14.2 generated 2 ephemeral supplier capability links (values redacted)");
