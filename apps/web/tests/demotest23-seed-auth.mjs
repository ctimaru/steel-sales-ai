/**
 * DEMOTEST2.3: create REAL Supabase GoTrue password identities only on local CI.
 * No production URLs, provider email delivery, superadmin escalation or keys in artifacts.
 * Creates user-vars.psql (IDs only) plus temporary 0600 credentials for Chrome.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
assert.match(url, /^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/, "DEMOTEST2.3 ONLY allows local Supabase");
const serviceRoleKey = process.env.DEMOTEST23_LOCAL_SERVICE_ROLE_KEY;
assert.ok(serviceRoleKey && serviceRoleKey.length > 20, "Local service role key required");
assert.ok(process.env.RUNNER_TEMP, "RUNNER_TEMP must identify an ephemeral CI directory");
const temp = process.env.RUNNER_TEMP;
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const personas = [
  { id: "buyer", type: "end_user", name: "DEMO Industrial Engineering", email: "dt23-buyer@example.test", org: "00000000-0000-0000-0000-000000023301", rfq: "00000000-0000-0000-0000-000000023321", rfqTitle: "DEMOTEST23 BUYER PRIVATE MIXED EN10210 EN10219" },
  { id: "producer", type: "producer", name: "DEMO Steel Manufacturing", email: "dt23-producer@example.test", org: "00000000-0000-0000-0000-000000023302", rfq: "00000000-0000-0000-0000-000000023322", rfqTitle: "DEMOTEST23 PRODUCER PRIVATE RFQ" },
  { id: "trader", type: "trader_distributor", name: "DEMO Tubes Trading", email: "dt23-trader@example.test", org: "00000000-0000-0000-0000-000000023303", rfq: "00000000-0000-0000-0000-000000023323", rfqTitle: "DEMOTEST23 TRADER PRIVATE RFQ" },
  { id: "processor", type: "processor_service_provider", name: "DEMO Steel Processing", email: "dt23-processor@example.test", org: "00000000-0000-0000-0000-000000023304", rfq: "00000000-0000-0000-0000-000000023324", rfqTitle: "DEMOTEST23 PROCESSOR PRIVATE RFQ" },
  { id: "buyerViewer", type: "end_user_viewer", name: "DEMO Industrial Engineering", email: "dt23-buyer-viewer@example.test", org: "00000000-0000-0000-0000-000000023301", rfq: "00000000-0000-0000-0000-000000023321", rfqTitle: "DEMOTEST23 BUYER PRIVATE MIXED EN10210 EN10219" },
];

const variables = [];
for (const p of personas) {
  const password = randomBytes(24).toString("base64url") + "Aa1!";
  const { data, error } = await admin.auth.admin.createUser({
    email: p.email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  assert.ok(data?.user?.id, p.id + " GoTrue user missing");
  p.userId = data.user.id;
  p.password = password;
  variables.push("\\set " + p.id + "_user_id '" + p.userId + "'");
  console.log("LOCAL GOTHROUGH AUTH CREATED", p.id, p.type);
}

const credsPath = path.join(temp, "demotest23-personas.json");
const varsPath = path.join(temp, "demotest23-psql-vars.sql");
writeFileSync(credsPath, JSON.stringify(personas, null, 2), { mode: 0o600 });
writeFileSync(varsPath, variables.join("\n") + "\n", { mode: 0o600 });
chmodSync(credsPath, 0o600);
chmodSync(varsPath, 0o600);
console.log("LOCAL AUTH SETUP PASS: 5 independent GoTrue identities; temporary credentials never uploaded");
