import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const library = read("../lib/network-free.ts");
const presentation = read("../components/network-launch-discovery.tsx");
const migration = read("../../../supabase/migrations/20261017150000_netlaunch3_read_100_discoveries.sql");

test("NET-LAUNCH3: all existing company read paths request 100, role probe stays one", () => {
  assert.ok([...library.matchAll(/p_limit:\s*100/g)].length >= 2);
  assert.match(library,/netlaunch4b_browse_page/);
  assert.match(library, /p_limit:1,/);
  assert.match(presentation, /\.slice\(0,maxItems\?\?24\)/);
});

test("NET-LAUNCH3: SQL widens read cap only, without bypassing authorized Free\/Pro paths", () => {
  assert.equal([...migration.matchAll(/limit least\(greatest\(coalesce\(p_limit,50\),1\),100\)/g)].length, 3);
  assert.match(migration, /private\.netux11_require_active_company\(p_organization_id\)/);
  assert.match(migration, /private\.pa1_3_require_network_access\(p_organization_id\)/);
  assert.match(migration, /SECURITY DEFINER/i);
  assert.doesNotMatch(migration, /grant execute|create policy|service_role|insert into|update public\.network_/i);
});
