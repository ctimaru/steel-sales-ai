import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../lib/network-free.ts",import.meta.url),"utf8");
test("NET-LAUNCH5D: provisional profiles survive canonical lookup errors",()=>{
  assert.match(source,/if \(error \|\| data === null\) \{/);
  assert.match(source,/supabase\.rpc\("netfast_free_profile"/);
  assert.match(source,/netfast-discovery-profile-v1/);
  assert.match(source,/if \(error\) throw new Error\("network_free_profile_unavailable"\)/);
  assert.match(source,/if \(discoveryError\) throw new Error\("network_discovery_profile_unavailable"\)/);
});
